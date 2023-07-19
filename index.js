const express = require('express');
const app = express()
const http = require('http')
const cors = require("cors")
const puppeteer = require("puppeteer")

const { Server } = require("socket.io")

app.use(cors())
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
})

io.on("connection", (socket) => {
    console.log(socket.id)
    let num = 0;

    let keepRunning = true;
    let currentCost = 0;

    socket.on("start_search", (shouldSearch) => {

        num = 0;
        keepRunning = true;
        console.log("Emails: " + shouldSearch.emailsIf + "\nContacts: " + shouldSearch.contactsIf)
        try {
            start();
        }
        catch (error) {
            io.emit("error", {error})
        }



        async function start() {
            currentCost = 0;
            const browser = await puppeteer.launch({headless: true});
            const page = await browser.newPage();

            let City = shouldSearch.location
          
            let string = "local " + shouldSearch.businessType + " in " + shouldSearch.location
            let splitString = string.split(" ");
            let url = "";
            for (let i = 0; i < splitString.length; i++) {
                if (splitString[i] == "&") {
                    splitString[i] = "%26"
                }
        
                if (i != 0) {
                    
                    url += "+" + splitString[i]
                }
                else {
                    url += splitString[i]
                }
            }
            
            url = `https://www.google.com/search?tbs=lf:1,lf_ui:14&tbm=lcl&q=${url}`;
            await page.goto(url);
          
            let businesses = await page.$$(".vwVdIc");
            
            let pages = await page.$$(".fl")
          
            
          
            let numPages = pages.length;
            try {
                for (let i = 0; i < numPages; i++) {
                    
                    if (keepRunning) {
                        await lookAtBusinessInPage(page, businesses, browser, City);
                        pages = await page.$$('.fl');
                        await pages[i].click();
                        await new Promise((resolve) => setTimeout(resolve, 5000))
                        businesses = await page.$$(".vwVdIc");
                    }
                }
            }
            catch (error) {
                console.log(error)
            }
            io.emit("closing")
            browser.close()
          
            
        };
          
        async function lookAtBusinessInPage(page, businesses, browser, City) {
            // await new Promise((resolve) => setTimeout(resolve, 5000));

                let previousBusiness = "";
        
                for (let i = 0; i < businesses.length; i++) {
                    if (keepRunning) {
                        
                        let purpose = "";
                        let phoneNumber = "";
                        let businessName = "";
                        let websiteLink = "";
                        let address = "";
                        let emails = null;
                        let contactInfo = null;
            
                        await businesses[i].click();
                        await page.waitForTimeout(2000);
            
                        
                        console.log("here")
                        try {
                            let bizNameElement = await page.waitForSelector('.qrShPb', { timeout: 5000 });
                            let bizName = await bizNameElement.$('span');
                            businessName = await bizName.evaluate(element => element.textContent);
                        } catch (error) {
                            businessName = "No Business name found";
                        }

                        if (shouldSearch.contactsIf) {
                            try {
                                contactInfo = await searchForContactInformation(businessName, shouldSearch.location);
                            }
                            catch (error) {
                                contactInfo = null;
                                continue;
                            }
                            if (contactInfo != null) {
                                currentCost += 5;
                            }
                            else {
                                continue;
                            }
                        }
                        
                        

                        if (shouldSearch.emailsIf) {
                            try {
                                emails = await searchForEmails({businessName, City}, browser);
                            }
                            catch (error) {
                                emails = null;
                                continue;
                            }
                            if (emails != null) {
                                currentCost += 5;
                            }
                            else {
                                continue;
                            }
                        }
                        
                        
                        
                        
                        try {
                            let phoneNumberElement = await page.waitForSelector('.zdqRlf', { timeout: 5000 }).catch(() => {});
                            let number = await phoneNumberElement.$('a');
                            phoneNumber = await number.$eval('span', element => element.textContent);
                            let object = {
                                PhoneNumber: phoneNumber,
                                BusinessName: "",
                                Address: "",
                                Reviews: "",
                                WebsiteLink: "",
                                Industry: ""
                            }
                        } catch (error) {
                            phoneNumber = "No phone num found";
                        }
            
                        
            
                        try {
                            let websiteElement = await page.waitForSelector('.mI8Pwc', { timeout: 5000 });
                            websiteLink = await websiteElement.evaluate(element => element.href);
                        } catch (error) {
                            console.log(error);
                        }
            
                        try {
                            let addressElement = await page.waitForSelector('.LrzXr', { timeout: 5000 });
                            address = await addressElement.evaluate(element => element.textContent);
                        } catch (error) {
                            address = "No address found";
                        }
            
                        try {
                            let purposeElements = await page.$$(".rllt__details");
                            let purposeDivs = await purposeElements[i].$eval('div:nth-child(2)', element => element.textContent);
                            purpose = formatReviews(purposeDivs);
                        } catch (error) {
                            console.log(error);
                            purpose = "No Industry found";
                        }

                        
                

                        if (i < 1) {
                            console.log("return")
                            const returnThing = {
                                BusinessName: businessName,
                                PhoneNumber: phoneNumber,
                                WebsiteLink: websiteLink,
                                Industry: purpose[0],
                                Reviews: purpose[1],
                                Address: address,
                                Emails: emails,
                                Info: contactInfo
                            }
                            socket.emit("business_info", returnThing)
                            } else {
                            if (previousBusiness == businessName) {
                                let e = "nothing";
                            } else {
                                console.log("return")
                                const returnThing = {
                                    BusinessName: businessName,
                                    PhoneNumber: phoneNumber,
                                    WebsiteLink: websiteLink,
                                    Industry: purpose[0],
                                    Reviews: purpose[1],
                                    Address: address,
                                    Emails: emails,
                                    Info: contactInfo
                                }
                            await socket.emit("business_info", returnThing)
                            }
                            
                        }
                        currentCost += 3;
                        console.log(currentCost)
                        
                        if (currentCost >= shouldSearch.searchCost) {
                            keepRunning = false;
                            console.log("number close")
                        }
                        previousBusiness = businessName;
                    }
                }
        }
        
        async function searchForEmails(object, browser) {
            const page = await browser.newPage();

            let string = object.businessName + " " + object.City;
            let splitString = string.split(" ")
            
            let url = ""

            for (let i = 0; i < splitString.length; i++) {
                if (splitString[i] == "&") {
                    splitString[i] = "%26"
                }

                if (i != 0) {
                    
                    url += "+" + splitString[i]
                }
                else {
                    url += splitString[i]
                }
            }

            url += "+facebook"

            try {
                await page.goto("https://www.google.com/search?q=" + url);
            } catch (error) {
                console.error('Failed to navigate:', error);
                await browser.close();
                return;
            }

            try {
            let button = await page.$(".DKV0Md")
            await button.click()

            await new Promise((resolve) => setTimeout(resolve, 3000)); 

            let x = await page.$x(`//*[@aria-label='Close']`);;
            await x[0].click()

            let textBox = await page.$x("//span[contains(text(), '.') and contains(text(), '@')]");
            let textContent = await page.evaluate((item) => item.textContent, textBox[0]);

            await page.close()
            return textContent;
            }
            catch (error) {
                await page.close();
                return null;
            }
        }
        
        function formatReviews(text) {
            let splitString = text.split("·")
            
        
            industry = splitString[1]
        
            reviews = splitString[0]
        
            reviews = reviews.split('\n')
        
            if (reviews.length > 1) {
                reviews = reviews[0] + " " +  reviews[1]
            }
            else {
                reviews = reviews[0]
            }
        
            return [industry, reviews]
        }
        
        async function searchForContactInformation(BusinessName, location) {
            const browser = await puppeteer.launch({headless: false});
            const page = await browser.newPage()
        
            let url = "https://www.google.com/search?q="
            let biz = BusinessName + " " + location;
            let splitString = biz.split(" ");
            for (let i = 0; i < splitString.length; i++) {
                if (splitString[i] == "&") {
                    splitString[i] = "%26"
                }
        
                if (i != 0) {
                    
                    url += "+" + splitString[i]
                }
                else {
                    url += splitString[i]
                }
            }
        
            url += "+BBB"
        
            let text = null;
            
            try {
                await page.goto(url)
        
                let BBB = await page.$$("a")
        
                for (let i = 0; i < BBB.length; i++) {
                    const text = await page.evaluate(element => element.textContent, BBB[i])
                    
                    if (text.includes("bbb.org")) {
                    const href = await BBB[i].getProperty("href")
                    const hrefValue = await href.jsonValue();
                    await page.goto((hrefValue + "/details"))
                    break;
                    }
                }
        
                const dd = await page.waitForXPath("//dt[contains(text(), 'Contact Information')]/following-sibling::*[1]", { timeout: 4000 });
                text = await dd.evaluate(el => el.textContent);
                }
            catch(error) {
                await browser.close()
                return null;
            }
        
            await browser.close()
            return text;
        }
    })

    socket.on("stop_running", () => {
        keepRunning = false;
        io.emit("trying_close")
    })
}) 

app.get("/", (req, res, next) => {
    res.write("hey")
    res.end();
})

server.listen("4000", () => {
    console.log("Server started")
})