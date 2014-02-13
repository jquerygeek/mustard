angular.module('mustard', [
    'ngRoute',
    'mustard.services',
    'mustard.app.login',
    'mustard.game.simulator',
    'leaflet-directive'
])

.config(function ($routeProvider) {

    $routeProvider
    .when('/login', {
        controller: 'LoginCtrl',
        templateUrl: 'js/app/controllers/login/login.tpl.html'
    })

    .when('/game/mission', {
        controller: 'SimulatorCtrl',
        templateUrl: 'js/game/controllers/simulator/mission.tpl.html',
        resolve: {
            scenario: ['$http', '$q', function ($http, $q) {
                var deferred = $q.defer();
                $http({
                    method: "GET",
                    url: "js/game/scenarios/PracticeScenario.json"
                }).success(function (response) {
                    deferred.resolve(response);
                });
                return deferred.promise;
            }]
        }
    })

    .when('/game/training', {
        controller: 'SimulatorCtrl',
        templateUrl: 'js/game/controllers/simulator/training.tpl.html',
        resolve: {
            scenario: ['$http', '$q', function ($http, $q) {
                var deferred = $q.defer();
                $http({
                    method: "GET",
                    url: "js/game/scenarios/PracticeScenario.json"
                }).success(function (response) {
                    deferred.resolve(response);
                });
                return deferred.promise;
            }]
        }
    })

    .otherwise({redirectTo: '/login'});
});
