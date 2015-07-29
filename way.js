var Way = {
    'version': "0.8.4",
    'map': function (path) {
        if (Way.routes.defined.hasOwnProperty(path)) {
            return Way.routes.defined[path];
        } else {
            return new Way.core.route(path);
        }
    },
    'root': function (path) {
        Way.routes.root = path;
    },
    'rescue': function (fn) {
        Way.routes.rescue = fn;
    },
    'history': {
        'initial':{}, // Empty container for "Initial Popstate" checking variables.
        'pushState': function(state, title, path){
            if(Way.history.supported){
                if(Way.dispatch(path)){
                    history.pushState(state, title, path);
                }
            } else {
                if(Way.history.fallback){
                    window.location.hash = "#" + path;
                }
            }
        },
        'popState': function(event){
            var initialPop = !Way.history.initial.popped && location.href == Way.history.initial.URL;
            Way.history.initial.popped = true;
            if(initialPop) return;
            Way.dispatch(document.location.pathname);
        },
        'listen': function(fallback){
            Way.history.supported = !!(window.history && window.history.pushState);
            Way.history.fallback  = fallback;

            if(Way.history.supported){
                Way.history.initial.popped = ('state' in window.history), Way.history.initial.URL = location.href;
                window.onpopstate = Way.history.popState;
            } else {
                if(Way.history.fallback){
                    for(route in Way.routes.defined){
                        if(route.charAt(0) != "#"){
                          Way.routes.defined["#"+route] = Way.routes.defined[route];
                          Way.routes.defined["#"+route].path = "#"+route;
                        }
                    }
                    Way.listen();
                }
            }
        }
    },
    'match': function (path, parameterize) {
        var params = {}, route = null, possible_routes, slice, i, j, compare;
        for (route in Way.routes.defined) {
            if (route !== null && route !== undefined) {
                route = Way.routes.defined[route];
                possible_routes = route.partition();
                for (j = 0; j < possible_routes.length; j++) {
                    params = {};
                    slice = possible_routes[j];
                    compare = path;
                    if (slice.search(/:/) > 0) {
                        for (i = 0; i < slice.split("/").length; i++) {
                            if ((i < compare.split("/").length) && (slice.split("/")[i].charAt(0) === ":")) {
                                params[slice.split('/')[i].replace(/:/, '')] = compare.split("/")[i];
                                compare = compare.split('/');
                                compare[i] = slice.split('/')[i];
                                compare = compare.join('/');
                            }
                        }
                    }
                    if (slice === compare) {
                        if (parameterize) {
                            route.params = params;
                        }
                        return route;
                    }
                }
            }
        }
        return null;
    },
    'dispatch': function (passed_route) {
        var previous_route, matched_route;
        if (Way.routes.current !== passed_route) {
            Way.routes.previous = Way.routes.current;
            Way.routes.current = passed_route;
            matched_route = Way.match(passed_route, true);

            if (Way.routes.previous) {
                previous_route = Way.match(Way.routes.previous);
                if (previous_route !== null && previous_route.do_exit !== null) {
                    previous_route.do_exit();
                }
            }

            if (matched_route !== null) {
                matched_route.run();
                return true;
            } else {
                if (Way.routes.rescue !== null) {
                    Way.routes.rescue();
                }
            }
        }
    },
    'listen': function () {
        var fn = function(){ Way.dispatch(location.hash); }

        if (location.hash === "") {
            if (Way.routes.root !== null) {
                location.hash = Way.routes.root;
            }
        }

        // The 'document.documentMode' checks below ensure that WayJS fires the right events
        // even in IE "Quirks Mode".
        if ("onhashchange" in window && (!document.documentMode || document.documentMode >= 8)) {
            window.onhashchange = fn;
        } else {
            setInterval(fn, 50);
        }

        if(location.hash !== "") {
            Way.dispatch(location.hash);
        }
    },
    'core': {
        'route': function (path) {
            this.path = path;
            this.action = null;
            this.do_enter = [];
            this.do_exit = null;
            this.params = {};
            Way.routes.defined[path] = this;
        }
    },
    'routes': {
        'current': null,
        'root': null,
        'rescue': null,
        'previous': null,
        'defined': {}
    }
};
Way.core.route.prototype = {
    'to': function (fn) {
        this.action = fn;
        return this;
    },
    'enter': function (fns) {
        if (fns instanceof Array) {
            this.do_enter = this.do_enter.concat(fns);
        } else {
            this.do_enter.push(fns);
        }
        return this;
    },
    'exit': function (fn) {
        this.do_exit = fn;
        return this;
    },
    'partition': function () {
        var parts = [], options = [], re = /\(([^}]+?)\)/g, text, i;
        while (text = re.exec(this.path)) {
            parts.push(text[1]);
        }
        options.push(this.path.split("(")[0]);
        for (i = 0; i < parts.length; i++) {
            options.push(options[options.length - 1] + parts[i]);
        }
        return options;
    },
    'run': function () {
        var halt_execution = false, i, result, previous;

        if (Way.routes.defined[this.path].hasOwnProperty("do_enter")) {
            if (Way.routes.defined[this.path].do_enter.length > 0) {
                for (i = 0; i < Way.routes.defined[this.path].do_enter.length; i++) {
                    result = Way.routes.defined[this.path].do_enter[i].apply(this, null);
                    if (result === false) {
                        halt_execution = true;
                        break;
                    }
                }
            }
        }
        if (!halt_execution) {
            Way.routes.defined[this.path].action();
        }
    }
};