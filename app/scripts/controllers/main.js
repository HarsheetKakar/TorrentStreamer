'use strict';

/* global Push */
angular.module('peerflixServerApp')
  .controller('MainCtrl', function ($scope, $resource, $log, $q, $upload, torrentSocket) {
    var Torrent = $resource('/torrents/:infoHash');

    var TorrentSearch = $resource('/search');
    var TorrentGetMagnet = $resource('/getMagnet');

    $scope.torrentList = []

    function load() {
      var torrents = Torrent.query(function () {
        $scope.torrents = torrents.reverse();
      });
    }

    $scope.downloadSearchItem = (torrent) => {
      TorrentGetMagnet.get({ torrent }).$promise.then(function (magnet) {
        $scope.link = magnet.magnet;
        $scope.download();
        $scope.torrentList = [];
      })
    }

    function loadTorrent(hash) {
      return Torrent.get({ infoHash: hash }).$promise.then(function (torrent) {
        var existing = _.find($scope.torrents, { infoHash: hash });
        if (existing) {
          var index = $scope.torrents.indexOf(existing);
          $scope.torrents[index] = torrent;
        } else {
          $scope.torrents.unshift(torrent);
        }
        return torrent;
      });
    }

    function findTorrent(hash) {
      var torrent = _.find($scope.torrents, { infoHash: hash });
      if (torrent) {
        return $q.when(torrent);
      } else {
        return loadTorrent(hash);
      }
    }

    load();

    function notifyFinished(torrent) {
      Push.create('Your torrent has finished downloading!', {
        body: torrent.name + ' has finished downloading.',
        icon: 'images/logo.png'
      });
    }

    $scope.keypress = function (e) {
      if (e.which === 13) {
        $scope.download();
      }
    };

    $scope.download = function () {
      if ($scope.link) {
        Torrent.save({ link: $scope.link }).$promise.then(function (torrent) {
          loadTorrent(torrent.infoHash);
        });
        $scope.link = '';
      }
    };

    $scope.getSearchItem = function () {
      console.log($scope.searchItem)
      if ($scope.searchItem) {
        TorrentSearch.get({ searchItem: $scope.searchItem }).$promise.then(function (torrentList) {
          $scope.torrentList = torrentList.torrents
        });
        $scope.searchItem = '';
      }
    };

    $scope.upload = function (files) {
      if (files && files.length) {
        files.forEach(function (file) {
          $upload.upload({
            url: '/upload',
            file: file
          }).then(function (response) {
            loadTorrent(response.data.infoHash);
          });
        });
      }
    };

    $scope.pause = function (torrent) {
      torrentSocket.emit(torrent.stats.paused ? 'resume' : 'pause', torrent.infoHash);
    };

    $scope.select = function (torrent, file) {
      torrentSocket.emit(file.selected ? 'deselect' : 'select', torrent.infoHash, torrent.files.indexOf(file));
    };

    $scope.selectAll = function (torrent) {
      torrentSocket.emit(torrent.selected ? 'deselect' : 'select', torrent.infoHash);
      torrent.files.forEach(function (f) {
        f.selected = !torrent.selected;
      });
    };

    $scope.remove = function (torrent) {
      Torrent.remove({ infoHash: torrent.infoHash });
      _.remove($scope.torrents, torrent);
    };

    torrentSocket.on('verifying', function (hash) {
      findTorrent(hash).then(function (torrent) {
        torrent.ready = false;
      });
    });

    torrentSocket.on('ready', function (hash) {
      loadTorrent(hash);
    });

    torrentSocket.on('interested', function (hash) {
      findTorrent(hash).then(function (torrent) {
        torrent.interested = true;
      });
    });

    torrentSocket.on('uninterested', function (hash) {
      findTorrent(hash).then(function (torrent) {
        torrent.interested = false;
      });
    });

    torrentSocket.on('finished', function (hash) {
      findTorrent(hash).then(notifyFinished);
    });

    torrentSocket.on('stats', function (hash, stats) {
      findTorrent(hash).then(function (torrent) {
        torrent.stats = stats;
      });
    });

    torrentSocket.on('download', function (hash, progress) {
      findTorrent(hash).then(function (torrent) {
        torrent.progress = progress;
      });
    });

    torrentSocket.on('selection', function (hash, selection) {
      findTorrent(hash).then(function (torrent) {
        if (!torrent.files) {
          return;
        }
        for (var i = 0; i < torrent.files.length; i++) {
          var file = torrent.files[i];
          file.selected = selection[i];
        }
        torrent.selected = _.every(torrent.files, 'selected');
      });
    });

    torrentSocket.on('destroyed', function (hash) {
      _.remove($scope.torrents, { infoHash: hash });
    });

    torrentSocket.on('disconnect', function () {
      $scope.torrents = [];
    });

    torrentSocket.on('connect', load);
  });
