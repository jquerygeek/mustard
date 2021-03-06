/**
 * @module subtrack90.game.messageList
 */

angular.module('subtrack90.game.messageList', ['ngAnimate', 'ngSanitize'])

/**
 * Period when new element in list is highlighted
 */
.constant('HIGHLIGHT_MILLIS', 3000)

/**
 * It adds .new class to the new item in the message list and removes the class after 3sec
 */
.animation('.message', function ($timeout, HIGHLIGHT_MILLIS) {
    return {
        enter: function (element, done) {
            element.addClass('new');

            $timeout(function() {
                element.removeClass('new');
                done();
            }, HIGHLIGHT_MILLIS);
        }
    };
})

/**
 * Message list directive
 */
.directive('messageList', function () {

    return {
        restrict: 'EA',
        templateUrl: 'js/game/directives/messageList/messageList.tpl.html',

        scope: {
            messages: '=',
            hasNew: '='
        }
    };
});
