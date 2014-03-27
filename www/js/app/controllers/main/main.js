angular.module('mustard.app.main', ['mustard.app.user'])

/**
 * @module Main
 * @class MainCtrl (controller)
 */
    .controller('MainCtrl', function ($scope, $location, user) {


        /** prototype version of the player state object
         *
         * @type {{name: string, achievements: *[], missions: *[]}}
         */
        $scope.player = user;

        /** prototype version of the mission index. Hopefully we will be able to automatically extract this
         * from the scenarios folder in some node/grunt script
         *
         * @type {*[]}
         */
        $scope.levels =
            [
                {"id": "1", "name": "Tutorial", "missions": [
                    {"id": "1a", "name": "Learner Driver", "description": "Learn to drive, on the tracked range", "url": "1a_drive_vessel"},
                    {"id": "1b", "name": "Reading Bearings", "description": "Learn to trail a bearing", "url": "1b_read_bearings"},
                    {"id": "1c", "name": "Handling ambiguity", "description": "Intro to ambiguous bearings", "url": "1c_resolve_ambiguity"},
                    {"id": "1d", "name": "Advanced Ambiguity", "description": "More advanced ambiguous bearings", "url": "1d_resolve_ambiguity_2"}
                ]},
                {"id": "2", "name": "Self Noise", "missions": [
                    {"id": "2a", "name": "Elementary Self Noise", "description": "An introduction to self-noise", "url": "2a_intro_self_noise"},
                    {"id": "2b", "name": "Full Self Noise", "description": "Full self-noise characteristics", "url": "2b_full_self_noise"},
                    {"id": "2c", "name": "Advanced Self Noise", "description": "Advanced Self Noise", "url": "2c_adv_self_noise"},
                    {"id": "2d", "name": "Self Noise Extra", "description": "More challenging self noise", "url": "2d_more_self_noise"}
                ]},
                {"id": "3", "name": "Active Targets", "missions": [
                    {"id": "3a", "name": "Fleeing Target", "description": "Trailing a fleeing target", "url": "3a_fleeing_target"},
                    {"id": "3b", "name": "Attacking Target", "description": "Evading an attacking target", "url": "3b_attacking_target"}
                ]},
                {"id": "4", "name": "Weapons", "missions": [
                    {"id": "4a", "name": "Weapons Intro", "description": "First use of weapons", "url": "4a_weapons_intro"}
                ]},
                {"id": "6", "name": "Complex Operating Areas", "missions": [
                    {"id": "6a", "name": "Merchant in area", "description": "Handling a cargo ship in the training area", "url": "6a_merchant"},
                    {"id": "6b", "name": "White Shipping", "description": "Handling multiple ships in the training area", "url": "6b_merchant_and_fisherman"}
                ]},
                {"id": "7", "name": "Complex Sonar", "missions": [
                    {"id": "7a", "name": "Unsteady Array", "description": "The effects of the array being unsteady", "url": "7a_array_unsteady"},
                    {"id": "7b", "name": "Quick Win", "description": "Test mission - wins quickly", "url": "7b_quick_win"},
                    {"id": "7c", "name": "Quick Fail", "description": "Test mission - fails quickly", "url": "7c_quick_fail"},
                    {"id": "7d", "name": "Placeholder", "description": "Test mission - does nothing", "url": "7d_placeholder"}
                ]}
            ];


        /** whether the specified mission is available to the user
         *
         * @param id the mission id
         * @returns {boolean}  is-complete
         */
        var isLocked = function (id) {
            var res = null;

            // ok, lookup this id in the player achievements
            var found = _.find($scope.player.missions, function (ach) {
                return ach.id == id;
            });

            // has this level been tried?
            if (found) {
                switch (found.status) {
                    case "SUCCESS":
                    case "FAILURE":
                    case "UNLOCKED":
                        res = false;
                        break;
                    case "LOCKED":
                        res = true;
                        break;
                }
            }

            // fallback - if we don't know about the layer, just lock it
            if (res === null) {
                res = true;
            }

            return res;
        };

        /** navigate to the specified URL, if the mission is avaialble to the current user
         *
         * @param id
         * @param url
         */
        $scope.moveToMission = function (id, url) {
            if (!isLocked(id)) {
                $location.path('mission/' + url);
            }
        };

        /** whether the specified mission is has been completed by this user
         *
         * @param id the mission id
         * @returns {String}  the glyph to use
         */
        $scope.glyphFor = function (id) {
            var res = false;
            // ok, lookup this id in the player achievemtns
            var found = _.find($scope.player.missions, function (ach) {
                return ach.id == id;
            });

            // has this level been tried?
            if (found) {
                switch (found.status) {
                    case "SUCCESS":
                        res = "glyphicon glyphicon-check";
                        break;
                    case "UNLOCKED":
                        res = "glyphicon glyphicon-unchecked";
                        break;
                    case "FAILURE":
                        res = "glyphicon glyphicon-unchecked";
                        break;
                    case "LOCKED":
                        res = "glyphicon glyphicon-lock";
                        break;
                }
            }

            // fallback - just lock it
            if (!res) {
                res = "glyphicon glyphicon-lock";
            }

            return res;
        };

    });
