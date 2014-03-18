/**
 * @module mustard.game.leafletMapDirective
 */

angular.module('mustard.game.leafletMapDirective', [])

.constant('leafletMapConfig', {
  initialZoom: 13,
  sonarBearingLines: {
    color: '#A9A9A9',
    weight: 2
  },
  ownshipPositionStyle: {
    radius: 5,
    opacity: 1
  }
})

.directive('leafletMap', ['leafletMapConfig', function (leafletMapConfig) {

  return {
    restrict: 'EA',
    scope: {},
    require: '^spatialView',
    link: function (scope, element, attrs, spatialViewController) {
      var layerGroups = {};
      var tileLayerUrl = 'img/mobac/atlases/MapQuest/{z}/{x}/{y}.jpg';
      var baseMap = L.tileLayer(tileLayerUrl);
      var leafletMarkers = {};
      var sonarMultiPolyline;
      var map;

      /**
       * Add scale and mouse positions information to the map layer.
       */
      var addMapFeatures = function () {
        var scaleConfig = {
          metric: true,
          imperial: true
        };

        L.control.scale(scaleConfig).addTo(map);
        L.control.mousePosition().addTo(map);
      };

      /**
       * Map layers configurations.
       */
      var configureLayers = function () {
        var controlLayers;

        layerGroups = {
          ownShip: L.layerGroup(),
          targets: L.layerGroup(),
          ownshipTraveling: L.layerGroup(),
          sonarDetections: L.layerGroup()
        };

        _.each(layerGroups, function (layer) {
          map.addLayer(layer);
        });

        controlLayers = new L.control.layers();
        controlLayers.addBaseLayer(baseMap, 'baseMap');
        controlLayers.addOverlay(layerGroups.ownShip, 'ownShip');
        controlLayers.addOverlay(layerGroups.targets, 'targets');
        controlLayers.addOverlay(layerGroups.ownshipTraveling, 'ownshipTraveling');
        controlLayers.addOverlay(layerGroups.sonarDetections, 'sonarDetections');
        controlLayers.addTo(map);
      };

      /**
       * Create or update markers on the map.
       * @param {Object} vessel
       */
      var vesselMarker = function (vessel) {
        if (leafletMarkers[vessel.name]) {
          updateMarker(vessel);
        } else {
          createMarker(vessel);

          // set map center according to ownship marker location and set proper initial zoom
          if (vessel.name === spatialViewController.ownShipName()) {
            map.setView([vessel.state.location.lat, vessel.state.location.lng], leafletMapConfig.initialZoom);
          }
        }
      };

      /**
       * Adjust center of the map depends on ownship position.
       * @param {Object} vessel
       */
      var panMapToOwnship = function (vessel) {
        if (vessel.name === spatialViewController.ownShipName()) {
          var ownshipLocation = L.latLng(vessel.state.location);
          if (!map.getBounds().contains(ownshipLocation)) {
            map.panTo(ownshipLocation);
          }
        }
      };

      /**
       * Update marker position and icon angle on the map.
       * @param vessel
       */
      var updateMarker = function (vessel) {
        var marker = leafletMarkers[vessel.name];
        marker.setLatLng([vessel.state.location.lat, vessel.state.location.lng]);
        marker.setIconAngle(vessel.state.course);
      };

      /**
       * Create (and update) config object for a vessel marker.
       * @param {Object} vessel
       * @returns {Object}
       */
      var createMarker = function (vessel) {
        // produce the icon for this vessel type
        var vType = vessel.categories.type.toLowerCase();

        // ok, and the icon initialisation bits
        var iconSize;
        switch (vessel.categories.type) {
          case "TORPEDO":
          case "HELICOPTER":
          case "FISHERMAN":
            iconSize = 32;
            break;
          case "SUBMARINE":
            iconSize = 48;
            break;
          case "MERCHANT":
          case "WARSHIP":
            iconSize = 64;
            break;
          default:
            console.log("PROBLEM - UNRECOGNISED VEHICLE TYPE: " + vessel.categories.type);
            break;
        }

        var icon = L.icon({
          iconAngle: 0,
          iconUrl: 'img/vessels/' + iconSize + '/' + vType + '.png',
          iconSize: [iconSize, iconSize],
          iconAnchor: [iconSize / 2, iconSize - iconSize / 5]
        });

        var marker = new L.marker();
        marker.setIconAngle(vessel.state.course);
        marker.setLatLng([vessel.state.location.lat, vessel.state.location.lng]);

        if ('RED' === vessel.categories.force) {
          // nope, hide it by default
          marker.setIcon(icon);
          layerGroups.targets.addLayer(marker);
        } else {
          // ok, show it.
          marker.setIcon(icon);
          layerGroups.ownShip.addLayer(marker);
        }

        leafletMarkers[vessel.name] = marker;
      };

      /**
       * Create Leaflet map.
       */
      var createMap = function () {
        map = new L.Map(element[0], {attributionControl: false});

        L.tileLayer(tileLayerUrl).addTo(map);

        configureLayers();
        addMapFeatures();
      };

      /**
       * Change vessels' markers on the map.
       */
      scope.$on('changeMarkers', function (event, vessels) {
        _.each(vessels, function (vessel) {
          vesselMarker(vessel);
          panMapToOwnship(vessel);
        });
      });

      /**
       * Show geoJSON map features.
       */
      scope.$on('showFeatures', function (event, features) {
        if (features) {
            L.geoJson(features, {
              style: {
                clickable: false
              }
            }).addTo(map);
        }
      });

      /**
       * Add ownship traveling point.
       */
      scope.$on('addOwnshipTravelingPoint', function (event, latlngs) {
        if (latlngs) {
          var circleMarker = L.circleMarker(latlngs, leafletMapConfig.ownshipPositionStyle);
          layerGroups.ownshipTraveling.addLayer(circleMarker);
          spatialViewController.updateOwnshipTravelingPoints(layerGroups.ownshipTraveling.getLayers());
        }
      });

      /**
       * Delete exprired ownship traveling point.
       */
      scope.$on('deleteOwnshipTravelingPoint', function (event, marker) {
        map.removeLayer(marker);
      });

      /**
       * Show sonar bearing lines.
       */
      scope.$on('addSonarDetection', function (event, latlngs) {
        if (sonarMultiPolyline) {
          sonarMultiPolyline.setLatLngs(latlngs);
        } else {
          sonarMultiPolyline = L.multiPolyline(latlngs, leafletMapConfig.sonarBearingLines);

          layerGroups.sonarDetections.addLayer(sonarMultiPolyline);
        }
      });

      createMap();
    }
  };
}]);
