angular.module('evtviewer.box')

.provider('evtBox', function() {

    var defaults = this.defaults;

    this.setDefaults = function(_defaults) {
        defaults = _defaults;
    };

    this.$get = function($log, $q, parsedData, evtCriticalParser, xmlParser, evtInterface) {        
        var box        = {},
            collection = {},
            list       = [],
            idx        = 0;

        var _console = $log.getInstance('box');

        // 
        // Control function
        // 
        function updateState(key, value) {
            // _console.log('vm - updating state '+key+': '+value);
            var vm        = this;
            vm.state[key] = value;
            return vm.state[key];            
        }

        function getState(key) {
            var vm = this;
            return vm.state[key];
        }

        function destroy() {
            var tempId = this.uid;
            // this.$destroy();
            delete collection[tempId];
            // _console.log('vm - destroy ' + tempId);
        }

        // Critical edition control
        function toggleCriticalAppFilter(filter, value){
            var vm      = this,
                filters = vm.state.filters;
            if (filters[filter] === undefined ) {
                filters[filter] = {
                    name       : filter,
                    any        : true,
                    totActive  : 0,
                    values     : {
                                    length : 0
                                }
                };
            }
            if ( filters[filter].totActive === undefined ) {
                filters[filter].totActive = 0;
            }

            var values = filters[filter].values;
            if (values[value] === undefined) {
                values[values.length] = value;
                values[value] = { 
                                    name   : value,
                                    active : true,
                                    color  : parsedData.getCriticalEntriesFilterColor(filter, value) 
                                };
                values.length++;
            } else {
                values[value].active = !values[value].active;
            }
            
            if (values[value].active) {
                filters[filter].totActive++;
                filters._totActive++;
            } else {
                filters[filter].totActive--;
                filters._totActive--;
            }
            
            filters[filter].any = (filters[filter].totActive === 0);
        }

        function clearFilter(filter){
            var vm = this;
            vm.state.filters[filter].values    = { length: 0 };
            vm.state.filters._totActive       -= vm.state.filters[filter].totActive;
            vm.state.filters[filter].totActive = 0;
        }


        function toggleTopBox() {
            var vm = this;
            if (vm.state.topBoxOpened !== undefined) {
                vm.state.topBoxOpened = !vm.state.topBoxOpened;
            }
        }

        function toggleFilterBox() {
            var vm = this;
            if (vm.state.filterBox !== undefined) {
                vm.state.filterBox = !vm.state.filterBox;
            }
        }

        function updateTopBoxContent(newContent) {
            var vm = this;
            vm.topBoxContent = newContent;
        }
        
        // 
        // Box builder
        // 
        box.build = function(scope, vm) {
            var currentId   = vm.id || idx++,
                currentType = vm.type || 'default',
                topMenuList = { 
                    selectors : [],
                    buttons   : []
                },
                bottomMenuList = { 
                    selectors : [],
                    buttons   : []
                },
                content,
                topBoxContent = '<span class="alert-msg">No info available</span>',
                state      = {
                    topBoxOpened : false
                },
                appFilters = [],
                updateContent,
                isLoading = true;

            var scopeHelper = {};

            if (typeof(collection[currentId]) !== 'undefined') {
                return;
            }
            
            // _console.log('vm - building box for ' + currentId);
            var newContent;
            switch (currentType) {
                case 'image':
                    topMenuList.selectors.push({id:'page_'+currentId, type: 'page', initValue: evtInterface.getCurrentPage() });
                    
                    topMenuList.buttons.push({title:'Thumbnails', label: 'Thumbs', icon: 'thumbs', type: 'thumbs' });

                    updateContent = function(){
                        scope.vm.isLoading = true;
                        var currentPage = evtInterface.getCurrentPage(),
                            pageFacs    = parsedData.getPage(evtInterface.getCurrentPage()).facs || '',
                            folder      = 'data/images/';
                        scope.vm.content = '<img src="'+folder+pageFacs+'" alt="Image of page '+currentPage+' of '+evtInterface.getCurrentDocument()+'"/>';
                        scope.vm.isLoading = false;
                    };
                    break;
                case 'text':
                    //TODO: Differentiate main text from second one
                    topMenuList.selectors.push({id:'document_'+currentId, type: 'document', initValue: evtInterface.getCurrentDocument() },
                                               {id:'editionLevel_'+currentId, type: 'edition', initValue: evtInterface.getCurrentEdition() });
                    topMenuList.buttons.push({title: 'Witnesses List', label: '', icon: 'list', type: 'witList'});

                    bottomMenuList.buttons.push({title: 'Search in edition', label: 'Search', icon: 'search', type: 'searchInEdition'});

                    // if (evtInterface.getCurrentViewMode() === 'critical') {
                    //     topMenuList.buttons.push({ title: 'Add Witness', label: '', icon: 'add', type: 'addWit'});
                    // }
                    state.docId   = evtInterface.getCurrentDocument();
                    updateContent = function(){
                        scope.vm.isLoading = true;
                        var errorMsg           = '<span class="alert-msg alert-msg-error">There was an error in the parsing of the text. <br />Try a different browser or contact the developers.</span>',
                            noTextAvailableMsg = '<span class="alert-msg alert-msg-error">Text is not available.</span>';
                        if ( scope.vm.edition !== undefined && scope.vm.edition === 'critical') {
                            var newDoc = parsedData.getCriticalText(scope.vm.state.docId);
                            if (newDoc === undefined) {
                                newDoc = parsedData.getDocument(scope.vm.state.docId);
                                try {
                                    var promises = [];
                                    promises.push(evtCriticalParser.parseCriticalText(newDoc.content, scope.vm.state.docId).promise);
                                    $q.all(promises).then(function(){
                                        scope.vm.content = parsedData.getCriticalText(scope.vm.state.docId) || noTextAvailableMsg;
                                        scope.vm.isLoading = false;
                                    });
                                }
                                catch(err) {
                                    newContent = errorMsg;
                                    scope.vm.isLoading = false;
                                }
                            } else {
                                scope.vm.content = newDoc || noTextAvailableMsg;
                                scope.vm.isLoading = false;
                            }
                        } else {
                            scope.vm.content = parsedData.getDocument(scope.vm.state.docId) || noTextAvailableMsg;
                            scope.vm.isLoading = false;
                        }
                    };
                    break;
                case 'critical_apparatus':
                    state.docId   = evtInterface.getCurrentDocument();
                    updateContent = function(){
                        var newContent = ''; 
                        var criticalEntries = parsedData.getCriticalEntries();
                        for (var i in criticalEntries._indexes.appEntries) {
                            var appId = criticalEntries._indexes.appEntries[i],
                                app   = criticalEntries[appId];
                            if (!app._lacuna){
                                newContent += '<evt-critical-apparatus-entry data-app-id="'+appId+'"></evt-critical-apparatus-entry>';
                            }
                        }
                        scope.vm.content = newContent;
                    };
                    break;
                case 'witness':
                    var witPageId = vm.witPage !== undefined && vm.witPage !== '' ? vm.witness+'-'+vm.witPage : '';
                    topMenuList.selectors.push({id:'witnesses_'+currentId, type: 'witness', initValue: vm.witness },
                                               {id:'page_'+currentId, type: 'witness-page', initValue: witPageId });
                    
                    topMenuList.buttons.push({title: 'Info', label: '', icon: 'info', type: 'toggleInfoWit' },
                                             {title: 'Remove Witness', label: '', icon: 'remove', type: 'removeWit' });

                    bottomMenuList.buttons.push({title: 'Filters', label: 'Filters', icon: 'filters', type: 'toggleFilterApp' },
                                                {title: 'Search in witness', label: 'Search', icon: 'search', type: 'searchInWit' });

                    appFilters    = parsedData.getCriticalEntriesFilters();
                    state.filters = {
                        _totActive : 0
                    };
                    state.filterBox = false;
                    updateContent = function(){
                        scope.vm.isLoading = true;
                        var errorMsg           = '<span class="alert-msg alert-msg-error">There was an error in the parsing of the text. <br />Try a different browser or contact the developers.</span>',
                            noTextAvailableMsg = 'Text of witness '+vm.witness+' is not available.';
                        
                        if ( vm.witness !== undefined ) {
                            // Main content
                            var currentDocId = evtInterface.getCurrentDocument(),
                                newContent = parsedData.getWitnessText(vm.witness, currentDocId) || undefined;
                            if ( newContent === undefined ) {
                                var documents  = parsedData.getDocuments(),
                                    currentDoc = '';
                                if (documents.length > 0) {
                                    currentDoc = documents[currentDocId];
                                }
                                if (currentDoc !== undefined) {
                                    try {
                                        var promises = [];
                                        promises.push(evtCriticalParser.parseWitnessText(currentDoc.content, currentDocId, vm.witness).promise);
                                        $q.all(promises).then(function(){
                                            scope.vm.content = parsedData.getWitnessText(vm.witness, currentDocId) || noTextAvailableMsg;
                                            scope.vm.isLoading = false;
                                        });
                                    }
                                    catch(err) {
                                        scope.vm.content = errorMsg;
                                        scope.vm.isLoading = false;
                                    }
                                } else {
                                    scope.vm.content = noTextAvailableMsg;
                                    scope.vm.isLoading = false;
                                }
                            } else {
                                scope.vm.content = newContent;
                                scope.vm.isLoading = false;
                            }
                        }
                    };
                    break;
            }

            scopeHelper = {
                // expansion
                uid                     : currentId,
                defaults                : angular.copy(defaults),

                // model
                topMenuList             : topMenuList,
                bottomMenuList          : bottomMenuList,
                content                 : content,
                topBoxContent           : topBoxContent,
                state                   : state,
                appFilters              : appFilters,
                isLoading               : isLoading,

                // function
                updateContent           : updateContent,
                updateTopBoxContent     : updateTopBoxContent,
                updateState             : updateState,
                getState                : getState,
                destroy                 : destroy,
                toggleCriticalAppFilter : toggleCriticalAppFilter,
                toggleFilterBox         : toggleFilterBox,
                toggleTopBox            : toggleTopBox,
                clearFilter             : clearFilter
            };

            collection[currentId] = angular.extend(vm, scopeHelper);
            list.push({
                id   : currentId,
                type : currentType
            });

            return collection[currentId];
        };


        //
        // Service function
        // 
        box.getById = function(currentId) {
            if (collection[currentId] !== 'undefined') {
                return collection[currentId];
            }
        };

        box.getList = function() {
            return list;
        };

        box.getListByType = function(type) {
            var listType = [];
            for (var i in collection) {
                if (collection[i].type === type) {
                    listType.push(collection[i]);
                }
            }
            return listType;
        };

        return box;
    };

});