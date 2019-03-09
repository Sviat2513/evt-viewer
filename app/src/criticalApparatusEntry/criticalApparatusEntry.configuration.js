angular.module('evtviewer.criticalApparatusEntry')

.constant('APPENTRYDEFAULTS', {
    firstSubContentOpened : '',
    allowedTabs: ['criticalNote', 'notSignificantReadings', 'moreInfo', 'xmlSource']
})

.config(function(evtCriticalApparatusEntryProvider, configProvider, APPENTRYDEFAULTS) {
    var defaults = configProvider.makeDefaults('criticalApparatusEntry', APPENTRYDEFAULTS);
    evtCriticalApparatusEntryProvider.setDefaults(defaults);
});