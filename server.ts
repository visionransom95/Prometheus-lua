import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";

import fengari from 'fengari';
const { lua, lualib, lauxlib, to_jsstring } = fengari;
import interop from 'fengari-interop';

// Initialize Lua State
const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);
interop.luaopen_js(L);

// We define DO_OBF universally available
const initLua = `
  math.log10 = math.log10 or function(x)
    return math.log(x) / math.log(10)
  end

  arg = {}
  -- Update path to find Prometheus
  package.path = "${path.resolve('./prometheus-source')}/?.lua;${path.resolve('./prometheus-source')}/?/init.lua;${path.resolve('./prometheus-source/src')}/?.lua;${path.resolve('./prometheus-source/src')}/?/init.lua;" .. package.path
  
  local Prometheus = require("prometheus")
  Prometheus.colors.enabled = false
  
  function DO_OBF(src, presetName)
      local preset = Prometheus.Presets[presetName]
      if not preset then
          preset = Prometheus.Presets.Medium
      end
      local pipeline = Prometheus.Pipeline:fromConfig(preset)
      return pipeline:apply(src, "input.lua")
  end
`;

lauxlib.luaL_dostring(L, fengari.to_luastring(initLua));

let filesProtected = 0;
const sseClients = new Set<express.Response>();

function broadcastStats() {
  const data = JSON.stringify({ filesProtected });
  for (const client of sseClients) {
    client.write(`data: ${data}\n\n`);
  }
}

// Keep connections alive
setInterval(() => {
  for (const client of sseClients) {
    client.write(': keepalive\n\n');
  }
}, 30000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  app.get("/api/stats/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    sseClients.add(res);
    broadcastStats();

    req.on("close", () => {
      sseClients.delete(res);
      broadcastStats();
    });
  });

  app.post("/api/obfuscate", (req, res) => {
    try {
      const { code, preset } = req.body;
      if (!code) {
        return res.status(400).json({ error: "No code provided" });
      }

      // We call the Lua function
      // Since it requires calling with strings from JS easily, we can use global vars or push
      lua.lua_getglobal(L, fengari.to_luastring("DO_OBF"));
      lua.lua_pushstring(L, fengari.to_luastring(code));
      lua.lua_pushstring(L, fengari.to_luastring(preset || "Medium"));
      
      const pcallRes = lua.lua_pcall(L, 2, 1, 0);
      if (pcallRes !== lua.LUA_OK) {
        let errorMsg = to_jsstring(lua.lua_tostring(L, -1));
        lua.lua_pop(L, 1);
        
        // Remove internal Lua trace prefixes like "logger.lua:56: "
        errorMsg = errorMsg.replace(/^.*?logger\.lua:\d+:\s*/, '');
        errorMsg = errorMsg.replace(/^\[string ".*?"\]:\d+:\s*/, '');
        errorMsg = errorMsg.replace(/^PROMETHEUS:\s*/, '');
        
        return res.status(400).json({ error: errorMsg });
      }

      const obfuscated = to_jsstring(lua.lua_tostring(L, -1));
      lua.lua_pop(L, 1);

      filesProtected++;
      broadcastStats();

      res.json({ output: obfuscated });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on http://localhost:" + PORT);
  });
}

startServer();
