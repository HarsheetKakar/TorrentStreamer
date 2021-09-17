#!/usr/bin/env node
'use strict';

var STATIC_OPTIONS = { maxAge: 3600000 };

var express = require('express'),
  http = require('http'),
  path = require('path'),
  serveStatic = require('serve-static'),
  socket = require('./socket'),
  api = require('./')
    .use(serveStatic(path.join(__dirname, '../dist'), STATIC_OPTIONS))
    .use(serveStatic(path.join(__dirname, '../.tmp'), STATIC_OPTIONS))
    .use(serveStatic(path.join(__dirname, '../app'), STATIC_OPTIONS));

var address, _ = require("os").networkInterfaces()
var local = process.env.NODE_ENV == "local"

var server = http.createServer(api);
socket(server);
var port = process.env.PORT || 9000;

server.listen(port, local ? address : "192.168.29.90").on('error', function (e) {
  if (e.code !== 'EADDRINUSE' && e.code !== 'EACCES') {
    throw e;
  }
  console.error('Port ' + port + ' is busy. Trying the next available port...');
  server.listen(++port);
}).on('listening', function () {
  console.log('Listening on http://localhost:' + port);
});
