-- This Script is Part of the Prometheus Obfuscator by levno-710
--
-- cli.lua
--
-- This Script contains the Code for the Prometheus CLI

-- Configure package.path for requiring Prometheus
package.path = "/app/applet/prometheus-source/?.lua;/app/applet/prometheus-source/?/init.lua;" .. package.path
require("src.cli");