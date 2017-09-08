(function() {
  'use strict';
  angular.module('app.setup')
    .factory('ServerConfig', ServerConfig);

  ServerConfig.$inject = ['$http', '$q', '$timeout', 'SearchAdmin', 'UIService'];

  function ServerConfig($http, $q, $timeout, SearchAdmin, UIService) {
    var serverConfig = {};
    var databasePropertiesPromise;
    serverConfig.get = function() {
      var config = {},
        defered = [],
        configItems = {
          databaseName: 'getDatabaseName',
          chartData: 'getCharts',
          searchOptions: 'getSearchOptions',
          fields: 'getFields',
          rangeIndexes: 'getRangeIndexes',
          geospatialIndexes: 'getGeospatialIndexes',
          uiConfig: 'getUiConfig',
          databases: 'getDatabases'
        },
        defaults = {
          databaseName: 'Documents',
          chartData: {
            charts: []
          },
          searchOptions: {
            option: {
              constraint: []
            }
          },
          fields: {
            'field-list': []
          },
          rangeIndexes: {
            'range-index-list': []
          },
          geospatialIndexes: {
            'geospatial-index-list': []
          },
          defaultSource: '',
          uiConfig: {},
          databases: []
        };
      angular.forEach(configItems, function() {
        defered.push($q.defer());
      });
      var promises = _.map(defered, function(d) {
        return d.promise;
      });
      if (databasePropertiesPromise) {
        databasePropertiesPromise = null;
      }
      var recursiveRun = function(keys, index) {
        if (index < keys.length) {
          var d = defered[index],
            key = keys[index],
            value = configItems[key];
          serverConfig[value](true).then(function(result) {
            config[key] = result || defaults[key];
            recursiveRun(keys, index + 1);
            d.resolve(result);
          }, function(reason) {
            config[key] = defaults[key];
            d.resolve(config[key]);
            recursiveRun(keys, index + 1);
            return reason;
          });
        }
      };

      recursiveRun(Object.keys(configItems), 0);

      return $q.all(promises).then(function() {
        return config;
      }, function() {
        return config;
      });
    };

    serverConfig.getDatabaseProperties = function(cache) {
      if (!(databasePropertiesPromise && cache)) {
        databasePropertiesPromise = $http.get('/api/server/database')
          .then(function(response) {
              return response.data;
            },
            $q.reject);
      }
      return databasePropertiesPromise;
    };

    serverConfig.getCharts = function() {
      return $http.get('/api/server/charts')
        .then(function(response) {
            return response.data;
          },
          $q.reject)
        .catch(function (err) {
          return {};
        });
    };

    serverConfig.setCharts = function(charts) {
      return $http.put('/api/server/charts', charts)
        .then(function(response) {
            return response.data;
          },
          $q.reject)
        .catch(function (err) {});
    };

    serverConfig.getDatabaseName = function(cache) {
      return serverConfig.getDatabaseProperties(cache).then(
        function(dbProperties) {
          return dbProperties['database-name'];
        },
        $q.reject
      )
      .catch(function (err) {});
    };

    serverConfig.getFields = function(cache) {
      return serverConfig.getDatabaseProperties(cache).then(
        function(dbProperties) {
          var fieldList = [];
          angular.forEach(dbProperties.field, function(field) {
            if (field['field-name'] && field['field-name'] !== '') {
              fieldList.push(field);
            }
          });
          return {
            'field-list': fieldList
          };
        },
        $q.reject
      );
    };

    serverConfig.setFields = function(fields) {
      return $http.put('/api/server/database', {
          field: fields['field-list']
        })
        .then(function(response) {
          return response.data;
        }, $q.reject);
    };

    var geospatialIndexTypes = ['geospatial-element-index', 'geospatial-element-pair-index', 'geospatial-element-attribute-pair-index'];
    serverConfig.getGeospatialIndexes = function(cache) {
      return serverConfig.getDatabaseProperties(cache).then(
        function(dbProperties) {
          var rangeIndexes = [];
          angular.forEach(geospatialIndexTypes, function(indexType) {
            angular.forEach(dbProperties[indexType], function(index) {
              var modIndex = {};
              modIndex[indexType] = index;
              rangeIndexes.push(modIndex);
            });
          });
          return {
            'geospatial-index-list': rangeIndexes
          };
        },
        $q.reject
      );
    };

    serverConfig.setGeospatialIndexes = function(geospatialIndexes) {
      var dbProperties = {};
      var key;
      for (key in geospatialIndexTypes) {
        dbProperties[geospatialIndexTypes[key]] = [];
      }
      for (key in geospatialIndexes['geospatial-index-list']) {
        var type = Object.keys(geospatialIndexes['geospatial-index-list'][key])[0];
        dbProperties[type].push(geospatialIndexes['geospatial-index-list'][key][type]);
      }
      return $http.put('/api/server/database', dbProperties)
        .then(function(response) {
            return response.data;
          },
          $q.reject);
    };

    var rangeIndexTypes = [
      'range-element-index', 'range-element-attribute-index',
      'range-path-index', 'range-field-index'
    ];
    serverConfig.getRangeIndexes = function(cache) {
      return serverConfig.getDatabaseProperties(cache).then(
        function(dbProperties) {
          var rangeIndexes = [];
          angular.forEach(rangeIndexTypes, function(indexType) {
            angular.forEach(dbProperties[indexType], function(index) {
              var modIndex = {};
              modIndex[indexType] = index;
              rangeIndexes.push(modIndex);
            });
          });
          return {
            'range-index-list': rangeIndexes
          };
        },
        $q.reject
      );
    };

    serverConfig.setRangeIndexes = function(rangeIndexes) {
      var dbProperties = {};
      var key;
      for (key in rangeIndexTypes) {
        dbProperties[rangeIndexTypes[key]] = [];
      }
      for (key in rangeIndexes['range-index-list']) {
        var type = Object.keys(rangeIndexes['range-index-list'][key])[0];
        dbProperties[type].push(rangeIndexes['range-index-list'][key][type]);
      }
      return $http.put('/api/server/database', dbProperties)
        .then(function(response) {
            return response.data;
          },
          $q.reject);
    };

    serverConfig.getSearchOptions = function() {
      return $http.get('/api/server/search-options')
        .then(function(response) {
            return response.data;
          },
          $q.reject);
    };

    serverConfig.setSearchOptions = function(searchOptions) {
      return $http.put('/api/server/search-options', searchOptions)
        .then(function(response) {
            return response.data;
          },
          $q.reject);
    };

    serverConfig.find = function(localname, type) {
      return $http.get('/api/server/database/content-metadata', {
          params: {
            localname: localname,
            type: type
          }
        })
        .then(function(response) {
            return response.data;
          },
          $q.reject);
    };

    serverConfig.loadData = function(directory) {
      return $http.get('/api/server/database/load-data', {
          params: {
            directory: directory
          }
        })
        .then(function(response) {
            return response.data;
          },
          $q.reject);
    };

    serverConfig.getUiConfig = function() {
      return UIService.getUIConfig();
    };

    serverConfig.setUiConfig = function(uiConfig) {
      return UIService.setUIConfig(uiConfig);
    };

    serverConfig.getDatabases = function() {
      return $http.get('/api/server/databases')
        .then(function(response) {
            return _.map(response.data['database-default-list']['list-items']['list-item'],
              function(db) {
                return db.nameref;
              });
          },
          $q.reject);
    };

    serverConfig.setDatabase = function(dbConfig) {
      return $http.put('/api/server/database', dbConfig)
        .then(function(response) {
          return response.data;
        });
    };

    serverConfig.removeDataCollection = function(collection) {
      return $http.delete('/api/server/database/collection/' + collection)
        .then(function(response) {
            return response;
          },
          $q.reject);
    };

    serverConfig.dataTypes = function() {
      return [
        'int',
        'unsignedInt',
        'long',
        'unsignedLong',
        'float',
        'double',
        'decimal',
        'dateTime',
        'time',
        'date',
        'gYearMonth',
        'gYear',
        'gMonth',
        'gDay',
        'yearMonthDuration',
        'dayTimeDuration',
        'string',
        'anyURI'
      ];
    };

    function arrayBuffer2base64(arrayBuf) {
      var bytes = new Uint8Array(arrayBuf),
        len = bytes.byteLength,
        binary = [];

      for (var i = 0; i < len; i++) {
        binary.push(String.fromCharCode( bytes[ i ] ));
      }
      return window.btoa( binary.join('') );
    }

    function uploadBatch(files, collections) {
      var promises = [];
      var epochTicks = 621355968000000000;
      var ticksPerMillisecond = 10000;
      var yourTicks = epochTicks + ((new Date()).getTime() * ticksPerMillisecond);
      var boundary = 'BOUNDARY' + yourTicks;
      var header = '--' + boundary + '\r\n';
      var footer = '--' + boundary + '--\r\n';
      var mixedContentType = 'multipart/mixed; boundary=' + boundary;

      var contents = [];
      if (collections && collections.length) {
        var collectionsMeta = '<?xml version="1.0" encoding="UTF-8"?>\r\n' +
            '<rapi:metadata xmlns:rapi="http://marklogic.com/rest-api">\r\n' +
            '  <rapi:permissions>\r\n' +
            '   <rapi:permission>\r\n' +
            '     <rapi:role-name>rest-reader</rapi:role-name>\r\n' +
            '     <rapi:capability>read</rapi:capability>\r\n' +
            '   </rapi:permission>\r\n' +
            '   <rapi:permission>\r\n' +
            '     <rapi:role-name>rest-writer</rapi:role-name>\r\n' +
            '     <rapi:capability>read</rapi:capability>\r\n' +
            '   </rapi:permission>\r\n' +
            '  </rapi:permissions>\r\n' +
            '  <rapi:collections>\r\n';
        angular.forEach(collections, function(collection) {
          collectionsMeta += '    <rapi:collection>' + collection + '</rapi:collection>\r\n';
        });
        collectionsMeta += '  </rapi:collections>\r\n</rapi:metadata>';
        contents.push(header);
        contents.push('Content-Type: application/xml\r\nContent-Disposition: inline; category=metadata\r\nContent-Length: ' + collectionsMeta.length);
        contents.push('\r\n\r\n');
        contents.push(collectionsMeta + '\r\n');
      }

      angular.forEach(files, function(file) {
        var reader = new FileReader(),
            fileName = file.webkitRelativePath || file.name,
            d = $q.defer();
        if (/^[^\/]/.test(fileName)) {
          fileName = '/' + fileName;
        }
        promises.push(d.promise);
        var contentType = file.type || 'text/plain';
        reader.onload = function (event) {
          var value;
          if (/^(text|application)\/(json|xml).*$/.test(contentType)) {
            value = new Uint8Array(event.target.result);
          } else {
            value = arrayBuffer2base64(event.target.result);
          }
          var contentBlockHeader = header + 'Content-Type: ' + contentType + '\r\n';
          contentBlockHeader += 'Content-Disposition: attachment; filename="' + fileName +
          '"\r\n';
          contentBlockHeader += 'Content-Transfer-Type: base64\r\n';
          contentBlockHeader += 'Content-Length: ' + value.length + '\r\n\r\n';
          contents.push(contentBlockHeader);
          contents.push(value);
          contents.push('\r\n');
          d.resolve();
        };
        reader.readAsArrayBuffer(file);
      });
      return $q.all(promises).then(function() {
        var finalD = $q.defer();
        var finalReader = new FileReader();
        finalReader.onload = function (event) {
          finalD.resolve(new Uint8Array(event.target.result));
        };
        contents.push(footer);
        var fullContent = new Blob(contents);
        finalReader.readAsArrayBuffer(fullContent);
        return finalD.promise.then(function(data) {
          return $http.post(
              '/v1/documents',
              data,
              {
                'headers':{'Content-Type': mixedContentType},
                'params': {
                  'transform': 'expand',
                  'trans:collections': collections ? collections.join(',') : null
                },
                'transformRequest':[]
              }
            );
        });
      });
    }

    // group into buckets by size
    var bucketSizeInBytes = 700000;

    function sortFileList(allFiles) {
      var sortedArray;
      if (allFiles.sort) {
        sortedArray = allFiles;
      } else {
        sortedArray = new Array(allFiles.length);
        for (var i = 0; i < allFiles.length; i++) {
          sortedArray[i] = allFiles[i];
        }
      }
      return sortFiles(sortedArray);
    }

    function sortFiles(allFiles) {
      return allFiles.sort(function(a, b) {
        return a.size - b.size;
      });
    }

    serverConfig.arrangeFiles = function(allFiles) {
      return _.filter(sortFileList(allFiles), function(val) {
        return val.name.indexOf('.') !== 0;
      });
    };

    serverConfig.bulkUpload = function(allFiles, collections) {
      var currentSet = [];
      var currentFilesToUpload = allFiles.length;
      var currentFilesUploaded = 0;
      var lastIndex = currentFilesToUpload - 1;
      var d = $q.defer();
      var currentBucketSize = 0;
      angular.forEach(allFiles, function(file, fileIndex) {
        currentSet.push(file);
        currentBucketSize = currentBucketSize + file.size;
        if (currentBucketSize >= bucketSizeInBytes || fileIndex === lastIndex) {
          currentBucketSize = 0;
          var currentSetCp = currentSet.slice(0, currentSet.length);
          var runUpload = function() {
            uploadBatch(currentSetCp, collections).then(function(data) {
              //$scope.loadDataInfo = data;
              //model.dataCollections.push(data.collection);
              currentFilesUploaded += currentSetCp.length;
              if (currentFilesToUpload === currentFilesUploaded) {
                d.resolve();
              } else {
                d.notify(currentFilesUploaded);
              }
            },
            function() {
              d.reject({ data: ''});
            });
          };
          if ($http.pendingRequests.length > 8) {
            $timeout(runUpload, $http.pendingRequests.length);
          } else {
            runUpload();
          }
          currentSet.length = 0;
        }
      });
      return d.promise;
    };

    serverConfig.clearData = function() {
      return $http.delete('/v1/search');
    };

    return serverConfig;
  }
}());
