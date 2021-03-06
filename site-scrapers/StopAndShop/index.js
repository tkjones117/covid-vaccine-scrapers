const { site } = require("./config");
const rxTouch = require("../../lib/RxTouch.js");
const moment = require("moment");

module.exports = async function GetAvailableAppointments(browser) {
    console.log(`${site.name} starting.`);
    const webData = await rxTouch.ScrapeRxTouch(browser, site, "StopAndShop");
    console.log(`${site.name} done.`);
    return site.locations.map((loc) => {
        const response = webData[loc.zip];
        return {
            name: `Stop & Shop (${loc.city})`,
            hasAvailability: !!Object.keys(response.availability).length,
            extraData: response.message,
            debug: response.debug,
            availability: response.availability,
            signUpLink: site.website,
            ...loc,
            timestamp: moment().format(),
        };
    });
};
