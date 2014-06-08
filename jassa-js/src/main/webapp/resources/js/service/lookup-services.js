(function() {

    var ns = jassa.service;
    
    ns.LookupService = Class.create({
        getIdStr: function(id) {
            console.log('Not overridden');
            throw 'Not overridden';
        },

        /**
         * This method must return a promise for a Map<Id, Data>
         */
        lookup: function(ids) {
            console.log('Not overridden');
            throw 'Not overridden';
        }
    });
    
    
    /**
     * This function must convert ids to unique strings
     * Only the actual service (e.g. sparql or rest) needs to implement it
     * Layers on top of it (e.g. caching, delaying) will then delegate to the
     * inner-most getIdStr function.
     *
     */
    ns.LookupServiceBase = Class.create(ns.LookupService, {
        getIdStr: function(id) {
            var result = '' + id;
            return result;
        }
    });

    ns.LookupServiceDelegateBase = Class.create(ns.LookupService, {
        initialize: function(delegate) {
            this.delegate = delegate;
        },

        getIdStr: function(id) {
            var result = this.delegate.getIdStr(id);
            return result;
        }
    });

    /**
     * Lookup service is simply a service that can asynchronously map ids to documents (data).
     *
     */
    ns.LookupServiceCache = Class.create(ns.LookupServiceDelegateBase, {
        initialize: function($super, delegate, requestCache) {
            $super(delegate);
            this.requestCache = requestCache || new service.RequestCache();
        },
        
        /**
         * This method must return a promise for the documents
         */
        lookup: function(ids) {
            var self = this;

            //console.log('cache status [BEFORE] ' + JSON.stringify(self.requestCache));

            // Make ids unique
            var uniq = _(ids).uniq(false, function(id) {
                var idStr = self.getIdStr(id);                
                return idStr;
            });

            var resultMap = new util.HashMap();

            var resultCache = this.requestCache.getResultCache();
            var executionCache = this.requestCache.getExecutionCache();
            
            // Check whether we need to wait for promises that are already executing
            var open = [];
            var waitForIds = [];
            var waitForPromises = [];
            
            _(uniq).each(function(id) {
                var idStr = self.getIdStr(id);

                var data = resultCache.getItem(idStr);
                if(!data) {
                    
                    var promise = executionCache[idStr];
                    if(promise) {
                        waitForIds.push(id);

                        var found = _(waitForPromises).find(function(p) {
                            var r = (p == promise);
                            return r;
                        });

                        if(!found) {
                            waitForPromises.push(promise);
                        }
                    }
                    else {
                        open.push(id);
                        waitForIds.push(id);
                    }
                } else {
                    resultMap.put(id, data);
                }
            });
            
            
            if(open.length > 0) {
                var p = this.fetchAndCache(open);
                waitForPromises.push(p);
            }
            
            var result = jQuery.when.apply(window, waitForPromises).pipe(function() {
                var maps = arguments;
                _(waitForIds).each(function(id) {
                    
                    var data = null;
                    _(maps).find(function(map) {
                        data = map.get(id);
                        return !!data;
                    });
                    
                    if(data) {
                        resultMap.put(id, data);
                    }
                });
                
                return resultMap;
            });
            
            return result;
        },
        
        /**
         * Function for actually retrieving data from the underlying service and updating caches as needed.
         *
         * Don't call this method directly; it may corrupt caches!
         */
        fetchAndCache: function(ids) {
            var resultCache = this.requestCache.getResultCache();            
            var executionCache = this.requestCache.getExecutionCache();

            var self = this;
            
            var p = this.delegate.lookup(ids);
            var result = p.pipe(function(map) {
                
                var r = new util.HashMap();

                _(ids).each(function(id) {
                    //var id = self.getIdFromDoc(doc);
                    var idStr = self.getIdStr(id);
                    var doc = map.get(id);
                    resultCache.setItem(idStr, doc);
                    r.put(id, doc);
                });

                _(ids).each(function(id) {
                    var idStr = self.getIdStr(id);
                    delete executionCache[idStr];
                });
                
                return r;
            });

            _(ids).each(function(id) {
                var idStr = self.getIdStr(id);
                executionCache[idStr] = result;
            });
            
            return result;
        }
        
    });


    /**
     * Wrapper that collects ids for a certain amount of time before passing it on to the
     * underlying lookup service.
     */
    ns.LookupServiceTimeout = Class.create(ns.LookupServiceDelegateBase, {
        
        initialize: function(delegate, delayInMs, maxRefreshCount) {
            this.delegate = delegate;

            this.delayInMs = delayInMs;
            this.maxRefreshCount = maxRefreshCount || 0;
            
            this.idStrToId = {};
            this.currentDeferred = null;
            this.currentPromise = null;
            this.currentTimer = null;            
            this.currentRefreshCount = 0;
        },
        
        getIdStr: function(id) {
            var result = this.delegate.getIdStr(id);
            return result;
        },
        
        lookup: function(ids) {
            if(!this.currentDeferred) {
                this.currentDeferred = jQuery.Deferred();
                this.currentPromise = this.currentDeferred.promise();
            }

            var self = this;
            _(ids).each(function(id) {
                var idStr = self.getIdStr(id);
                var val = self.idStrToId[idStr];
                if(!val) {
                    self.idStrToId[idStr] = id;
                }
            });
            
            if(!this.currentTimer) {
                this.startTimer();
            }

            // Filter the result by the ids which we requested
            var result = this.currentPromise.pipe(function(map) {
                var r = new util.HashMap();
                _(ids).each(function(id) {
                    var val = map.get(id);
                    r.put(id, val);
                });
                return r;
            });
            
            
            return result;
        },
        
        startTimer: function() {

            var self = this;
            var seenRefereshCount = this.currentRefreshCount;
            var deferred = self.currentDeferred;
            
            this.currentTimer = setTimeout(function() {
                
                if(self.maxRefreshCount < 0 || seenRefereshCount < self.maxRefreshCount) {
                    //clearTimeout(this.currentTimer);
                    ++self.currentRefreshCount;
                    self.startTimer();
                    return;
                }
                
                var ids = _(self.idStrToId).values();
                
                self.idStrToId = {};
                self.currentRefreshCount = 0;
                self.currentDeferred = null;
                self.currentTimer = null;

                var p = self.delegate.lookup(ids);
                p.pipe(function(map) {
                    deferred.resolve(map);
                }).fail(function() {
                    deferred.fail();
                });
                
            }, this.delayInMs);
        }

        // TODO Rather than refresing for the whole time interval, we could
        // refresh upon every change (up to a maximum delay time)
        /*
        var self = this;
        var isModified = false;
        _(ids).each(function(id) {
            var idStr = self.delegate.getIdStr(id);
            var val = self.idStrToId[idStr];
            if(!val) {
                idStrToId[idStr] = id;
                isModified = true;
            }
        });

        if(!isModified) {
            return result;
        }
        */

    });

    
    ns.LookupServiceSponate = Class.create(ns.LookupServiceBase, {
        initialize: function(source) {
            // Note: By source we mean e.g. store.labels
            this.source = source;
        },
        
        lookup: function(nodes) {
            var result = this.source.find().nodes(nodes).asList(true).pipe(function(docs) {
                var r = new util.HashMap();
                _(docs).each(function(doc) {
                    r.put(doc.id, doc);
                });
                return r;
            });

            return result;
        }
    });


    // In-place transform the values for the looked up documents
    ns.LookupServiceTransform = Class.create(ns.LookupServiceDelegateBase, {
        initialize: function($super, delegate, fnTransform) {
            $super(delegate);
            this.fnTransform = fnTransform;
        },
                
        lookup: function(ids) {
            var fnTransform = this.fnTransform;

            var result = this.delegate.lookup(ids).pipe(function(map) {
                
                _(ids).each(function(id) {
                    var val = map.get(id);
                    var t = fnTransform(val);
                    map.put(id, t);
                });
                
                return map;
            });
            
            return result;
        }
    });
    
})();