@echo off
title suuu
cd /d "%~dp0"
start "" http://localhost:5151
node server.js
