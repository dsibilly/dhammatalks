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
    Object.prototype.merge = function(other_obj) {
        var p;
        
        for (p in other_obj) {
            if (other_obj.hasOwnProperty(p)) {
                try {
                    // Property in this object is set; update its value.
                    if (other_obj[p] instanceof Object) {
                        this[p].merge(other_obj[p]);
                    } else {
                        this[p] = other_obj[p];
                    }
                } catch (e) {
                    // Property in this object NOT set; create and set value.
                    this[p] = other_obj[p];
                }
            }
        }
    };
    
    exports.config = function () {
        var node_env = process.env.NODE_ENV || 'development';
        
        if (env.all) {
            // Merge global config values into config object!
            env[node_env].merge(env.all);
        }
        
        return env[node_env];
    };
}());