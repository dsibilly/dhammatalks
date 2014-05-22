/**
common.js
A set of common useful code for use across a project. Commonly used to bootstrap
applications with settings for development and production environments.
*/
(function () {
    'use strict';
    
    // Import the config vars in env.json
    var env = require('../env.json');
    
    // A recursive object merge function
    Object.prototype.merge = function(otherObj) {
        var p;
        
        for (p in otherObj) {
            if (otherObj.hasOwnProperty(p)) {
                try {
                    // Property in this object is set; update its value.
                    if (otherObj[p] instanceof Object) {
                        this[p].merge(otherObj[p]);
                    } else {
                        this[p] = otherObj[p];
                    }
                } catch (e) {
                    // Property in this object NOT set; create and set value.
                    this[p] = otherObj[p];
                }
            }
        }
    };
    
    exports.config = function () {
        var nodeEnv = process.env.NODE_ENV || 'development';
        
        if (env.all) {
            // Merge global config values into config object!
            env[nodeEnv].merge(env.all);
        }
        
        return env[nodeEnv];
    };
}());