/* global MLSearchController */
(function() {
  'use strict';

  angular.module('app.search')
  .controller('SearchCtrl', SearchCtrl);

  SearchCtrl.$inject = [
  '$scope', '$location', '$window',
  'userService', 'MLSearchFactory', 'RegisteredComponents',
  'ServerConfig', 'MLQueryBuilder'
  ];

  // inherit from MLSearchController
  var superCtrl = MLSearchController.prototype;
  SearchCtrl.prototype = Object.create(superCtrl);

  function SearchCtrl(
    $scope, $location, $window,
    userService, searchFactory,
    RegisteredComponents, ServerConfig, qb
    ) {
    var ctrl = this;
    var mlSearch = searchFactory.newContext();

    

    ctrl.pageExtensions = RegisteredComponents.pageExtensions();

    ctrl.hasPageExtensions = false;

    $scope.$watch(function() {
      return _.filter(ctrl.pageExtensions, function(val) {
        return val.active;
      }).length;
    },function(newVal) {
      ctrl.hasPageExtensions = newVal > 0;
    });

    $scope.decodeURIComponent = $window.decodeURIComponent;

    ServerConfig.getCharts().then(function(chartData) {
      ctrl.charts = chartData.charts;
    });

    ctrl.setSnippet = function(type) {
      mlSearch.setSnippet(type);
      ctrl.search();
    };

    ctrl.setSort = function(type) {
      mlSearch.setSort(type);
      ctrl.search();
    };

    ctrl.showMoreFacets = function(facet, facetName) {
      mlSearch.showMoreFacets(facet, facetName);
    };

    $scope.$watch(userService.currentUser, function(newValue) {
      ctrl.currentUser = newValue;
    });

    /* BEGIN Date/DateTime constraint logic */
    ctrl.dateFilters = {};
    ctrl.dateStartOpened = {};
    ctrl.dateEndOpened = {};
    ctrl.pickerDateStart = {};
    ctrl.pickerDateEnd = {};
    ctrl.dateTimeConstraints = {};
    ctrl.datePickerOptions = {
      minDate: new Date(1900, 1, 1),
      maxDate: new Date(2050, 12, 31)
    };

    mlSearch.getStoredOptions().then(function(data) {
      ctrl.sortOptions = (_.filter(
        data.options.operator,
        function(val) {
          return val.name === 'sort';
        }
        )[0] || { state: []}).state;

      angular.forEach(data.options.constraint, function(constraint) {
        if (constraint.range && (constraint.range.type === 'xs:date' ||
         constraint.range.type === 'xs:dateTime')) {
          ctrl.dateTimeConstraints[constraint.name] = {
            name: constraint.name,
            type: constraint.range.type
          };
        }
      });

      MLSearchController.call(ctrl, $scope, $location, mlSearch);

      ctrl.init();

      // add in components for d3.cloud
      // override the updateSearchResults function from superCtrl to append a call to updateCloud..
      ctrl.updateSearchResults = function updateSearchResults(data) {
        superCtrl.updateSearchResults.apply(ctrl, arguments);
        ctrl.updateCloud(data);
        return ctrl;
      };

      ctrl.words = [];

      ctrl.updateCloud = function(data) {
        if (data && data.facets && data.facets.TagCloud) {
          ctrl.words = [];
          var activeFacets = [];

      // find all selected facet values..
      angular.forEach(mlSearch.getActiveFacets(), function(facet, key) {
        angular.forEach(facet.values, function(value, index) {
          activeFacets.push((value.value+'').toLowerCase());
        });
      });

      angular.forEach(data.facets.TagCloud.facetValues, function(value, index) {
        var q = (ctrl.qtext || '').toLowerCase();
        var val = value.name.toLowerCase();

        // suppress search terms, and selected facet values from the D3 cloud..
        if (q.indexOf(val) < 0 && activeFacets.indexOf(val) < 0) {
          ctrl.words.push({name: value.name, score: value.count});
        }
      });
    }
  };

  ctrl.noRotate = function(word) {
    return 0;
  };

  ctrl.cloudEvents = {
    'dblclick': function(tag) {
      // stop propagation
      d3.event.stopPropagation();

      // undo default behavior of browsers to select at dblclick
      var body = document.getElementsByTagName('body')[0];
      window.getSelection().collapse(body,0);

      // custom behavior, for instance search on dblclick
      ctrl.search((ctrl.qtext ? ctrl.qtext + ' ' : '') + tag.text.toLowerCase());
    }
  };

  // end of d3cloud section 
});

    // implement superCtrl extension method
    ctrl.parseExtraURLParams = function () {
      var foundExtra = false;
      ctrl.pickerDateStart = {};
      ctrl.pickerDateEnd = {};
      angular.forEach($location.search(), function(val, key) {
        var constraintName;
        if (key.indexOf('startDate:') === 0) {
          constraintName = key.substr(10);
          ctrl.pickerDateStart[constraintName] = new Date(val);
          ctrl._applyDateFilter(constraintName);
          foundExtra = true;
        } else if (key.indexOf('endDate:') === 0) {
          constraintName = key.substr(8);
          ctrl.pickerDateEnd[constraintName] = new Date(val);
          ctrl._applyDateFilter(constraintName);
          foundExtra = true;
        }
      });
      if ($location.search().s) {
        foundExtra = true;
        mlSearch.setSort($location.search().s);
      }
      return foundExtra;
    };

    // implement superCtrl extension method
    ctrl.updateExtraURLParams = function () {
      angular.forEach(ctrl.pickerDateStart, function(val, key) {
        $location.search('startDate:' + key, _constraintToDateTime(key, val));
      });
      angular.forEach(ctrl.pickerDateEnd, function(val, key) {
        $location.search('endDate:' + key, _constraintToDateTime(key, val));
      });
      angular.forEach($location.search(), function(val, key) {
        if ((key.indexOf('startDate:') === 0 && !ctrl.pickerDateStart[key.substr(10)]) ||
          (key.indexOf('endDate:') === 0 && !ctrl.pickerDateEnd[key.substr(8)])) {
          $location.search(key, null);
      }
    });
    };

    ctrl._search = function () {
      ctrl.mlSearch.clearAdditionalQueries();
      for (var key in ctrl.dateFilters) {
        if (ctrl.dateFilters[key] && ctrl.dateFilters[key].length) {
          mlSearch.addAdditionalQuery(
            qb.and(
              ctrl.dateFilters[key]
              )
            );
        }
      }
      superCtrl._search.call(ctrl);
    };

    ctrl.openStartDatePicker = function(constraintName, $event) {
      $event.preventDefault();
      $event.stopPropagation();
      ctrl.dateStartOpened[constraintName] = true;
    };

    ctrl.openEndDatePicker = function(constraintName, $event) {
      $event.preventDefault();
      $event.stopPropagation();
      ctrl.dateEndOpened[constraintName] = true;
    };

    ctrl._applyDateFilter = function(constraintName) {
      ctrl.dateFilters[constraintName] = [];
      if (ctrl.pickerDateStart[constraintName] && ctrl.pickerDateStart[constraintName] !== '') {
        var startValue =
        _constraintToDateTime(constraintName, ctrl.pickerDateStart[constraintName]);
        ctrl.dateFilters[constraintName]
        .push(qb.ext.rangeConstraint(constraintName, 'GE', startValue));
      }
      if (ctrl.pickerDateEnd[constraintName] && ctrl.pickerDateEnd[constraintName] !== '') {
        var endValue = _constraintToDateTime(constraintName, ctrl.pickerDateEnd[constraintName]);
        ctrl.dateFilters[constraintName]
        .push(qb.ext.rangeConstraint(constraintName, 'LE', endValue));
      }
    };

    ctrl.applyDateFilter = function(constraintName) {
      ctrl._applyDateFilter(constraintName);
      ctrl.search();
    };

    ctrl.clearDateFilter = function(constraintName) {
      ctrl.dateFilters[constraintName].length = 0;
      ctrl.pickerDateStart[constraintName] = null;
      ctrl.pickerDateEnd[constraintName] = null;
      ctrl.search();
    };

    ctrl.dateOptions = {
      formatYear: 'yy',
      startingDay: 1
    };

    function _constraintToDateTime(constraintName, dateObj) {
      var constraintType = ctrl.dateTimeConstraints[constraintName].type;
      if (dateObj) {
        var dateISO = dateObj.toISOString();
        var dateValue = dateISO;
        if (constraintType === 'xs:date') {
          dateValue = dateISO.substr(0, dateISO.indexOf('T')) + '-06:00';
        }
        return dateValue;
      } else {
        return null;
      }
    }
    /* END Date/DateTime constraint logic */

    function isFacetConstraint(constraintName) {
      return constraintName && constraintName !== '$frequency';
    }

    ctrl.chartItemSelected = function(chart, name, xCategory, x, y, z, seriesName) {
      if (isFacetConstraint(chart.xAxisCategoriesMLConstraint)) {
        ctrl.mlSearch.toggleFacet(chart.xAxisCategoriesMLConstraint, xCategory);
      } else if (isFacetConstraint(chart.xAxisMLConstraint)) {
        ctrl.mlSearch.toggleFacet(chart.yAxisMLConstraint, x);
      } else if (isFacetConstraint(chart.yAxisMLConstraint)) {
        ctrl.mlSearch.toggleFacet(chart.yAxisMLConstraint, y);
      } else if (isFacetConstraint(chart.zAxisMLConstraint)) {
        ctrl.mlSearch.toggleFacet(chart.zAxisMLConstraint, z);
      } else if (isFacetConstraint(chart.seriesNameMLConstraint)) {
        ctrl.mlSearch.toggleFacet(chart.seriesNameMLConstraint, seriesName);
      } else if (isFacetConstraint(chart.dataPointNameMLConstraint)) {
        ctrl.mlSearch.toggleFacet(chart.dataPointNameMLConstraint, name);
      }
      ctrl.search();
    };
  }
}());
