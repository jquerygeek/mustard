angular.module('mustard.game.simulator', [
    'mustard.game.movementSimulation',
    'mustard.game.spatialViewDirective',
    'mustard.game.timeDisplayDirective',
    'mustard.game.timeRemainingDirective',
    'mustard.game.rangeCalculatorDirective',
    'mustard.game.shipControlsDirective',
    'mustard.game.fireWeaponDirective',
    'mustard.game.shipStateDirective',
    'mustard.game.timeBearingDisplayDirective',
    'mustard.game.objectiveListDirective',
    'mustard.game.decision',
    'mustard.game.detection',
    'mustard.game.reviewSnapshot',
    'mustard.game.geoMath',
    'mustard.game.movement',
    'mustard.game.objectives',
    'mustard.game.clickRepeat',
    'mustard.game.message',
    'mustard.game.newMessage',
    'mustard.app.user'
])

/**
* @module Game
* @class GameCtrl (controller)
*/
.controller('SimulatorCtrl', ['$scope', 'scenario', function ($scope, scenario) {

    /**
     * Indexed list of vessels in scenario
     * @type {Array}
     */
    $scope.vesselsScenario = scenario.vessels;

    /**
     * Indexed list of vessels in scenario
     * @type {Array}
     */
    $scope.vessels = {};

    /** the id for this mission (used to update user progress
     *
     * @type {String}
     */
    $scope.missionID = scenario.id;

    /**
     * OwnShip vessel API
     */
    $scope.ownShip = {};

    /** indexed list of dead vessels
     *
     * @type {{}}
     */
    $scope.deadVessels = {};

    /**
     * Indexed list of references
     * @type {Object}
     */
    $scope.referenceLocations = {};

    /**
     * Environment state
     * @type {Object}
     */
    $scope.environment = scenario.environment;

    /**
     * Mission objectives
     * @type {Object}
     */
    $scope.objectives = scenario.objectives;

    /**
     * Welcome message
     * @type {String}
     */
    $scope.welcome = scenario.welcome;

    /**
     * GeoJson map features
     * @type {Object}
     */
    $scope.mapFeatures = scenario.features;

    /**
     * what the user wishes the ownship vessel to do
     * @type {{course: number, speed: number}}
     */
    $scope.demandedState = {
        course: 0.00,
        speed: 1
    };

    /**
     * Current state of game
     * @type {Object}
     */
    $scope.gameState = {
        state: 'DO_STOP',
        simulationTime: 0,
        simulationTimeStep: 2000,
        patrolArea: scenario.patrolArea
    };

    /**
     * Messages collection
     *
     * @type {Array}
     */
    $scope.messages = [];
}])

/**
* @module Game
* @class MissionCtrl (controller)
*/
.controller('MissionSimulatorCtrl', ['$scope', '$interval', '$q', 'geoMath', 'movement', 'decision', 'objectives',
        'detection', 'reviewSnapshot', 'user', '$timeout', 'steppingControls', 'message',
    function ($scope, $interval, $q, geoMath, movement, decision, objectives, detection,
        reviewSnapshot, user, $timeout, steppingControls, message) {

        /**
         * Configure FPS meters
         */
        var meters = {
            model: new FPSMeter($('#modelMeter')[0], {
                left: '50%',
                margin: '0 0 0 0'
            }),
            map: new FPSMeter($('#mapMeter')[0], {
                left: '90%',
                margin: '60px 0 0 0'
            }),
            sonar: new FPSMeter($('#sonarMeter')[0], {
                left: '5%',
                margin: '60px 0 0 0'
            })
        };

        var trackHistory = {};

        var startTime; // keep track of the start time, so we can pass the period to the history object.

        /**
         * Update sonar UI API
         */
        var sonarUi = {};

        /**
         * Update map UI API
         */
        var mapUi = {};

        /**
         * Ownship vessel API helper (since the ownship name 'may' change)
         * @returns {Object}
         */
        var ownShipApi = function () {
            var ownShipName = _.first(_.toArray($scope.vessels)).name;
            var vessel = $scope.vessels[ownShipName];

            return {
                name: function () {
                    return ownShipName;
                },
                vessel: function () {
                    return vessel;
                },
                location: function () {
                    return vessel.state.location;
                },
                state: function () {
                    return vessel.state;
                },
                detections: function () {
                    return vessel.newDetections;
                },
                updateState: function (data) {
                    _.extend(vessel.state, data);
                },
                /** whether this vessel can drive itself
                 *
                 * @returns {Boolean} yes/no
                 */
                autonomous: function() {
                  return vessel.behaviours && vessel.behaviours.length > 0;
                },
                /** whether the vessel is carrying any weapons
                 *
                 * @returns {Boolean} yes/no
                 */
                hasWeapons: function() {
                    return vessel.weapons && vessel.weapons.length > 0;
                },
                /** whether the vessel can perform ranging
                 *
                 * @returns {Boolean} yes/no
                 */
                ableToPerformRanging: function() {
                    return vessel.ableToPerformRanging;
                }
            }
        };

        var initializeTargetShips = function () {
            var deferred = $q.defer();

            _.each($scope.vessels, function (targetShip) {
                // see if the target has a location
                if (!targetShip.state.location) {

                    // cool, generate one - up to 10 miles from v1
                    var direction = Math.random() * 360;
                    var range = 2000 + Math.random() * 20000;

                    if ($scope.gameState.patrolArea) {
                        var pBounds = L.latLngBounds($scope.gameState.patrolArea);
                        targetShip.state.location = geoMath.rhumbDestinationPoint(pBounds.getCenter(),
                            geoMath.toRads(direction), range);
                    } else {
                        targetShip.state.location = geoMath.rhumbDestinationPoint(
                            $scope.ownShip.vessel().state.location,
                            geoMath.toRads(direction), range);
                    }
                }

                if (!targetShip.state.course) {
                    var newCourse = Math.random() * 360;
                    targetShip.state.course = newCourse;
                    targetShip.state.demCourse = newCourse;
                }

                if (!targetShip.state.speed) {
                    var newSpeed = 6 + Math.random() * 8;
                    targetShip.state.speed = newSpeed;
                    targetShip.state.demSpeed = newSpeed;
                }
            });

            $scope.gameState.state = 'RUNNING';

            deferred.resolve();
            return deferred.promise;
        };

        var handleMissionEnd = function () {
            // do we need to pause/stop?
            if (($scope.gameState.state === 'DO_PAUSE') || ($scope.gameState.state === 'DO_STOP')) {

                // take copy of game state
                var timeState = $scope.gameState.state;

                // scenario complete?
                if ($scope.gameState.successMessage) {
                    $scope.gameState.state = 'SUCCESS';
                    message.show('success', 'Success message', $scope.gameState.successMessage);
                    delete $scope.gameState.successMessage;
                } else if ($scope.gameState.failureMessage) {
                    $scope.gameState.state = 'FAILURE';
                    message.show('danger', 'Failure message', $scope.gameState.failureMessage);
                    delete $scope.gameState.failureMessage;
                }

                // are there any achievements?
                if ($scope.gameState.achievements) {
                    _.each($scope.gameState.achievements, function (element) {

                        // has this achievement already been processed?
                        if (!element.processed) {
                            element.processed = true;

                            // has the user already earned it?
                            if (!user.isAchievementPresent(element.name)) {
                                // ok, display it
                                user.addAchievement(element.name);

                                message.show('success', 'New achievement',
                                    "Well done, you've been awarded a new achievement:\n'" + element.name +
                                    "'\n\n" + element.message);
                            }
                        }
                    });
                }

                if (timeState === 'DO_PAUSE') {

                    // ok, resume
                    $scope.gameState.state = 'RUNNING';

                } else if ((timeState === 'DO_STOP') || (timeState === 'FAILURE')) {

                    // ok, stop the scenario
                    $scope.gameState.simulationTime = 0;

                    // hey was it success or failure?
                    if ($scope.gameState.state == "SUCCESS") {
                        user.missionCompleted($scope.missionID);
                    }
                    else if ($scope.gameState.state == "FAILURE") {
                        user.missionFailed($scope.missionID);
                    }

                    // for diagnostics, show any narrative entries
                    if ($scope.gameState.narratives) {
                        var showOnConsole = function (element) {
                            console.log("narrative. time:" + element.time + " location:" + element.location +
                                " msg:" + element.message);
                        };
                        console.log("== NARRATIVE ENTRIES FOR THIS MISSION ===");
                        _.each($scope.gameState.narratives, showOnConsole);
                        console.log("== ================================== ===");
                    }

                    // ok, store the snapshot
                    storeHistory();

                    // ok, move on to the review stage
                    message.show('info', 'Debriefing', 'Ready for the debriefing?', true).result.then(
                        function () {
                            message.show('info', 'Switch to the new route', 'Switch to the new route');
                        },

                        function () {
                            message.show('info', 'Let the user view/pan/zoom the plot',
                                'Let the user view/pan/zoom the plot');
                        }
                    );
                }
            }
        };

        var storeHistory = function () {
            var addDestroyedState = function () {
                _.each($scope.deadVessels, function (vessel) {
                    var history = trackHistory[vessel.name];
                    var lastTrack;

                    if (history) {
                        lastTrack = _.last(trackHistory[vessel.name].track);

                        if (lastTrack) {
                            _.extend(lastTrack, {
                                destroyed: true,
                                wasDestroyed: vessel.wasDestroyed
                            });
                        }
                    }
                });
            };

            var addCategoriesInfo = function () {
                var allVessels = _.extend({}, $scope.vessels, $scope.deadVessels, $scope.referenceLocations);

                // put in the categories
                _.each(allVessels, function (vessel) {
                    // get history
                    var history = trackHistory[vessel.name];
                    if (history) {
                        history.categories = angular.copy(vessel.categories);
                    }
                });
            };

            var putTrackHistory = function () {
                // do we have a track history
                if (_.size(trackHistory)) {
                    reviewSnapshot.put({
                        "period": [startTime, $scope.gameState.simulationTime],
                        "narratives": $scope.gameState.narratives,
                        "stepTime": $scope.gameState.simulationTimeStep,
                        "center": $scope.ownShip.location(),
                        "mapFeatures": $scope.mapFeatures,
                        "vessels": trackHistory
                    })
                }
            };

            addDestroyedState();
            addCategoriesInfo();
            putTrackHistory();
        };

        var updateMapObjects = function () {
            $scope.$broadcast('changeMarkers', $scope.vessels);
            $scope.$broadcast('vesselsStateUpdated');
            meters.map.tick();
        };

        /** capture (and store) the state of the vessel at this time
         *
         * @param vessel the vessel who's date wa are archiving
         * @param timeIndex used to index the state data
         */
        var storeState = function (vessel, timeIndex) {
            var track = {
                time: timeIndex,
                lat: vessel.state.location.lat,
                lng: vessel.state.location.lng,
                course: vessel.state.course,
                speed: vessel.state.speed
            };

            if (!trackHistory[vessel.name]) {
                trackHistory[vessel.name] = {};
                trackHistory[vessel.name].track = [];
            }

            trackHistory[vessel.name].track.push(track);
        };


        /**
         * Share ownship sonar detections.
         *
         */
        var shareSonarDetections = function (detections) {
            if (detections.length) {
                $scope.$broadcast('addDetections', detections);
            }

            meters.sonar.tick();
        };

        /**
         * collate current ownship sonar detections.
         *
         * @returns {Array}
         */
        var collateCurrentSonarDetections = function () {
            var detections = [];
            var thisB;

            _.each($scope.ownShip.detections(), function (detection) {
                // is this the first item?
                if (!detections.length) {
                    detections = [new Date(detection.time)];
                }

                thisB = detection.bearing;

                // clip to +/- 180
                if (thisB > 180) {
                    thisB -= 360;
                }

                // add this detection to the list
                detections.push(thisB);
            });

            return detections;
        };


        /**
         * Functionality to cache recent data
         * for a commodity/concept calling the UI
         * less frequently
         *
         * @param params {Object}
         * @returns {Object}
         */
        var cachedCommodity = function (params) {
            var defaults = {
                uiUpdateInterval: 1,
                skipFrames: 10
            };
            var params = _.extend(defaults, params);
            var frameCounter = 0;
            var maximumSkipFrames = 0;
            var uiUpdateInterval = 0;
            var nextUpdateInterval = 0;
            var cacheStorage = [];

            function init() {
                maximumSkipFrames = params.skipFrames;
                uiUpdateInterval = params.uiUpdateInterval * 1000;
                nextUpdateInterval = _.now() + params.uiUpdateInterval;
            }

            /** add the current data for this concept to the cache
             *
             */
            function cacheData() {
                var cache = [];

                if (_.isFunction(params.dataProvider)) {
                    cache = params.dataProvider();

                    // did we get any data?
                    if (cache  && cache.length > 0) {
                        cacheStorage.push(cache);
                    }
                }
            }

            /** the simulation has moved forward, maybe we should
             * update the UI
             */
            function update() {
                // retrieve (and store) any data for this cycle
                cacheData();

                if (_.now() >= nextUpdateInterval || frameCounter > maximumSkipFrames) {
                    // calculate the next update time BEFORE we update UI,
                    // so that it consumes some of the remaining time
                    nextUpdateInterval = _.now() + uiUpdateInterval;

                    // ok, trigger the UI update
                    params.updateHandler(cacheStorage);

                    // lastly, clear the cache, and get ready to restart
                    cacheStorage = [];
                    frameCounter = 0;
                } else {
                    // it's not time for us to move forward yet - increment the counter
                    frameCounter += 1;
                }
            }

            init();

            return {
                update: update
            }
        };

        /** move the scenario forwards one step - including all the simulated processes
         *
         */
        var doStep = function () {

            // capture any existing data
            var ownShipDone = false;
            _.each($scope.vessels, function (vessel) {

                // TODO: once we've overcome the requirement for the artificial ownship, remove this name test

                if (vessel.name == $scope.ownShip.name()) {
                    if (!ownShipDone) {
                        storeState(vessel, $scope.gameState.simulationTime);
                        ownShipDone = true;
                    }
                } else {
                    storeState(vessel, $scope.gameState.simulationTime);

                }

            });

            // can ownship drive itself?
            if(!$scope.ownShip.autonomous()) {

                // no, set the demanded states from the relevant control
                $scope.ownShip.updateState({
                    demCourse: parseInt($scope.demandedState.course),
                    demSpeed: parseInt($scope.demandedState.speed)
                });
            }

            /////////////////////////
            // GAME LOOP STARTS HERE
            /////////////////////////

            // loop through the vessels
            _.each($scope.vessels, function (vessel) {
                movement.doMove($scope.gameState.simulationTime, vessel.state, vessel.perf);
            });

            // now that everyone is in their new location, do the detections
            detection.doDetections($scope.gameState.simulationTime, $scope.vessels);

            // and now the decisions
            _.each($scope.vessels, function (vessel) {
                decision.doDecisions($scope.gameState.simulationTime, vessel.state,
                    vessel.newDetections, vessel.behaviours);
            });

            // let the referees run
            objectives.doObjectives($scope.gameState, $scope.objectives, $scope.vessels, $scope.deadVessels);

            // see if this mission is complete
            handleMissionEnd();

            // and now for UI updates
            meters.model.tick();
            sonarUi.update();
            mapUi.update();
            /////////////////////////
            // GAME LOOP ENDS HERE
            /////////////////////////
        };

        var showWelcome = function () {
            // show the welcome message
            if ($scope.welcome) {
                message.show('info', 'Welcome!', $scope.welcome);
            }
        };


        var doInit = function () {

            // loop through the scenario vessels, to do initialization
            _.each($scope.vesselsScenario, function (vessel) {

                // create a collection of vessels, indexed by name
                // NOTE: we're not using the short version of the name here.
                // in some scenarios Objectives objects specify which target
                // they relate to, by target name. So, we can't mangle the
                // indexed name value.
                $scope.vessels[vessel.name] = vessel;
            });

            // create a wrapped ownship instance, for convenience
            $scope.ownShip = ownShipApi();

            initializeTargetShips();

            $scope.demandedState.course = parseInt($scope.ownShip.state().demCourse);
            $scope.demandedState.speed = parseInt($scope.ownShip.state().demSpeed);

            // initialiee the start time
            startTime = $scope.gameState.simulationTime;

            showWelcome();

            $timeout(function () {
                // trigger an initial update of locations
                $scope.$broadcast('changeMarkers', $scope.vessels);
                $scope.$broadcast('showFeatures', $scope.mapFeatures);
            }, 100);
        };

        $scope.$watch('gameState.simulationTime', function (newVal) {
            if (newVal) {
                doStep();
            }
        });

        /**
         * Create reference location based on range maths location
         * @type {Object} location
         */
        $scope.addReferenceLocation = function (location) {
            var reference = {
                name: _.uniqueId('reference'),
                state: {
                    course: 0,
                    location: location
                },
                categories: {
                    force: "BLUE",
                    environment: "SURFACE",
                    type: "REFERENCE"
                }
            };

            storeState(reference, $scope.gameState.simulationTime);
            $scope.referenceLocations[reference.name] = reference;
            $scope.$broadcast('addReferenceMarker', reference);
        };

        objectives.onVesselsDestroyed(function (vessels) {
            $timeout(function () {
                $scope.$broadcast('vesselsDestroyed', vessels);
            }, 100);
        });

        /** listen out for the user selecting a track from the sonar
         *
         */
        $scope.$parent.$on('sonarTrackSelected', function (event, theTrackName) {
            $scope.ownShip.vessel().selectedTrack = theTrackName;
        });

        $scope.goBack = function () {
            window.history.back();
        };

        /**
         * When user leaves the page (e.g. press html "Back" or browser's button),
         * save simulation state to the review history
         */
        $scope.$on("$routeChangeStart", storeHistory);

        // show Stepping controls in TimeDisplay directive
        steppingControls.setVisibility(true);

        sonarUi = cachedCommodity({
            uiUpdateInterval: 0.5,
            skipFrames: 10,
            updateHandler: shareSonarDetections,
            dataProvider: collateCurrentSonarDetections
        });

        mapUi = cachedCommodity({
            uiUpdateInterval: 1,
            skipFrames: 5,
            updateHandler: updateMapObjects
        });

        // ok, do the init
        doInit();
    }
])


/**
* @module Game
* @class TrainingCtrl (controller)
*/
.controller('TrainingSimulatorCtrl', ['$scope', function ($scope) {

}]);
