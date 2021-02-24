const s3 = require("../lib/s3");
const sites = require("../data/sites.json");

const siteName = "StopAndShop";
const site = sites[siteName];
const noAppointmentMatchString = "no locations with available appointments";

module.exports = async function GetAvailableAppointments(browser) {
    console.log(`${siteName} starting.`);
    const webData = await ScrapeWebsiteData(browser);
    console.log(`${siteName} done.`);
    return site.locations.map((loc) => {
        const response = webData[loc.zip];
        return {
            name: `Stop & Shop (${loc.city})`,
            hasAvailability: response.indexOf(noAppointmentMatchString) == -1,
            extraData: response.length
                ? response.substring(1, response.length - 1)
                : response, //take out extra quotes
            signUpLink: site.website,
            ...loc,
            timestamp: new Date(),
        };
    });
};

async function ScrapeWebsiteData(browser) {
    const page = await browser.newPage();
    await page.goto(site.website);
    await page.solveRecaptchas().then(({ solved }) => {
        if (solved.length) {
            return page.waitForNavigation();
        } else {
            return;
        }
    });

    const results = {};

    for (const loc of [...new Set(site.locations)]) {
        if (!results[loc.zip]) {
            // Delete this cookie to avoid rate limiting after checking zip code 10 times.
            await page.deleteCookie({ name: "ASP.NET_SessionId" });
            await page.evaluate(
                () => (document.getElementById("zip-input").value = "")
            );
            await page.type("#zip-input", loc.zip);
            const [searchResponse, ...rest] = await Promise.all([
                Promise.race([
                    page.waitForResponse(
                        "https://stopandshopsched.rxtouch.com/rbssched/program/covid19/Patient/CheckZipCode"
                    ),
                    page.waitForNavigation(),
                ]),
                page.click("#btnGo"),
            ]);
            try {
                const result = (await searchResponse.buffer()).toString();
                //if there's something available, log it with a unique name so we can check it out l8r g8r
                if (result.indexOf(noAppointmentMatchString) == -1) {
                    // theoretically found appointments
                    if (!process.env.DEVELOPMENT) {
                        await s3.savePageContent(
                            `${siteName}-${loc.zip}`,
                            page
                        );
                    }
                }
                results[loc.zip] = result;
            } catch (e) {
                if (e.toString().includes("Protocol error")) {
                    console.log(
                        "Got a protocol error. Run chromium with headless=false to debug."
                    );
                }
                throw e;
            }
        }
    }

    return results;
}
