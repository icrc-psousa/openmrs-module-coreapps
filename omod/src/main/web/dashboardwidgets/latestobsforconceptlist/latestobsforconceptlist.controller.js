export default class LatestObsForConceptListController {
    constructor($filter, openmrsRest, widgetsCommons) {
        'ngInject';

        Object.assign(this, {$filter, openmrsRest, widgetsCommons });
    }

    $onInit() {
        this.openmrsRest.setBaseAppPath("/coreapps");
        this.maxAgeInDays = this.widgetsCommons.maxAgeToDays(this.config.maxAge);

        // Fetch last obs or obsGroup for the list of concepts
        this.openmrsRest.list('latestobs', {
            patient: this.config.patientUuid,
            v: 'custom:(' +
                'concept:(uuid,display,datatype:(uuid),names:(name,locale,localePreferred,voided,conceptNameType)),' +
                'value:(uuid,display,names:(name,locale,localePreferred,voided,conceptNameType)),' +
                'groupMembers:(concept:(display,names:(name,locale,localePreferred,voided,conceptNameType))))',
            concept: this.config.concepts.split(',').map(c => c.trim()).join(','),
            nLatestObs: this.config.nLatestObs || 1
        }).then((resp) => {
            // Process the results from the list of concepts as not all of them may have data
            this.obs = resp.results.filter(
                // Don't add obs older than maxAge
                obs => angular.isUndefined(this.maxAgeInDays) || this.widgetsCommons.dateToDaysAgo(obs.obsDatetime) <= this.maxAgeInDays
            ).map(inputObs => {
                const displayObs = {};
                displayObs.conceptName = this.getConceptName(inputObs.concept, this.config.conceptNameType);
                if (inputObs.groupMembers) { // If obs is obs group
                    displayObs.groupMembers = inputObs.groupMembers.map(member => {
                        const prefix = ["FSN", "shortName", "preferred"].includes(this.config.obsGroupLabels) ?
                            "(" + this.getConceptName(member.concept, this.config.obsGroupLabels) + ") " : "";
                        const value = this.getObsValue(member);
                        return { "prefix": prefix, "value": value };
                    });
                } else {
                    displayObs.value = this.getObsValue(inputObs);
                }
                return displayObs;
            });
        });
    }

    getObsValue(obs) {
        if (['8d4a505e-c2cc-11de-8d13-0010c6dffd0f',
            '8d4a591e-c2cc-11de-8d13-0010c6dffd0f',
            '8d4a5af4-c2cc-11de-8d13-0010c6dffd0f'].indexOf(obs.concept.datatype.uuid) > -1) {
            //If value is date, time or datetime
            return this.$filter('date')(new Date(obs.value), this.config.dateFormat);
        } else if (angular.isDefined(obs.value.display)) {
            //If value is a concept
             return this.getConceptName(obs.value, this.config.conceptNameType);
        } else {
            return obs.value;
        }
    }

    getConceptName(concept, nameType) {
        const names = concept.names.filter(n => !n.voided && n.locale === this.config.locale);
        const fsn = names.filter(n => n.conceptNameType === "FULLY_SPECIFIED")[0];
        const short = names.filter(n => n.conceptNameType === "SHORT")[0];
        const shortEn = concept.names.filter(n => !n.voided && n.locale === 'en' && n.conceptNameType === "SHORT")[0];
        const preferred = names.filter(n => n.localePreferred)[0];
        let resultName;
        if (nameType === "FSN") {
            resultName = fsn || preferred;
        } else if (nameType === "shortName") {
            resultName = short || shortEn;
        } else if (nameType === "preferred") {
            resultName = preferred;
        }
        return resultName ? resultName.name : concept.display;
    }
}