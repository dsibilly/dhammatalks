/**
date_utils.js
A simple module for formatting Date object data to strings for use in generating
podcast RSS XML.

@author Duane Sibilly <duane@sibilly.com>
*/
(function () {
    'use strict';
    
    var days = [
            'Sun',
            'Mon',
            'Tue',
            'Wed',
            'Thu',
            'Fri',
            'Sat' ],
        months = [
            'Jan',
            'Feb',
            'Mar',
            'Apr',
            'May',
            'Jun',
            'Jul',
            'Aug',
            'Sep',
            'Oct',
            'Nov',
            'Dec' ],
        dayOfTheWeek = function (date) {
            return days[ date.getDay() ];
        },
        monthAbr = function (date) {
            return months[ date.getMonth() ];
        },
        podcastFormat = function (date) {
            return dayOfTheWeek(date) + ', ' + date.getDate() + ' ' + monthAbr(date) + ' ' + date.getFullYear() + ' 18:00:00 -0800';
        };
    
    exports.podcastFormat = podcastFormat;
}());