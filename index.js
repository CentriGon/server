const express = require('express');
const app = express()
const http = require('http')
const cors = require("cors")
const puppeteer = require("puppeteer")

const { Server } = require("socket.io")

app.use(cors)
const server = http.createServer(app)

const io = new Server(server, {
    cors: {
        methods: ["GET", "POST"]
    }
})

io.on("connection", (socket) => {
    console.log(socket.id)
    let num = 0;

    let keepRunning = true;

    socket.on("start_search", (shouldSearch) => {

        num = 0;
        keepRunning = true;
        start();

        async function start() {
            const browser = await puppeteer.launch({headless: true});
            const page = await browser.newPage();
          
            const City = "alexandria virginia";
            const url = `https://www.google.com/search?tbs=lf:1,lf_ui:14&tbm=lcl&q=local+roofers+in+${City}`;
            await page.goto(url);
          
            let businesses = await page.$$(".vwVdIc");
            
            let pages = await page.$$(".fl")
          
            
          
            let numPages = pages.length;
            console.log(numPages)
            try {
                for (let i = 0; i < numPages; i++) {
                    
                    if (keepRunning) {
                        console.log("here");
                        await lookAtBusinessInPage(page, businesses, browser);
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
            console.log("closing")
            browser.close()
          
            
        };
          
        async function lookAtBusinessInPage(page, businesses, browser) {
            // await new Promise((resolve) => setTimeout(resolve, 5000));
        
                let previousBusiness = "";
        
                for (let i = 0; i < businesses.length; i++) {
                    if (keepRunning) {
                        let purpose = "";
                        let phoneNumber = "";
                        let businessName = "";
                        let websiteLink = "";
                        let address = "";
                        let emails = "";
                        let contactInfo = "";
            
                        await businesses[i].click();
                        await page.waitForTimeout(2000);
            
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
                            let bizNameElement = await page.waitForSelector('.qrShPb', { timeout: 5000 });
                            let bizName = await bizNameElement.$('span');
                            businessName = await bizName.evaluate(element => element.textContent);
                        } catch (error) {
                            businessName = "No Business name found";
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
                        console.log(businessName+ ", " + address + ", " + phoneNumber + ", " + websiteLink)

                        try {
                            if (shouldSearch.emailsIf) {
                                if (websiteLink != null && websiteLink != "") {
                                    console.log("emails")
                                    emails = await searchForEmails(websiteLink, browser);
                                }
                            }
                        }
                        catch (error) {
                            emails = null;
                        }

                        try {
                            if (shouldSearch.contactsIf) {
                                console.log("contacts")
                                contactInfo = await searchForContactInformation(businessName, "Alexandria VA");
                            }
                        }
                        catch (error) {
                            contactInfo = null;
                        }
                

                        if (i < 1) {
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
                            console.log("emitting")
                            await socket.emit("business_info", returnThing)
                            } else {
                            if (previousBusiness == businessName) {
                                let e = "nothing";
                            } else {
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
                                console.log("emitting")
                                await socket.emit("business_info", returnThing)
                            }
                            
                        }
                        
                        previousBusiness = businessName;
                    }
                }
        }
        
        async function searchForEmails(url, browser) {
            const page = await browser.newPage();
        
            let returnArray = []
            
            try {
                await page.goto(url);
            } catch (error) {
                console.error('Failed to navigate:', error);
                await browser.close();
                return;
            }
            
            let textContent = await page.evaluate(() => document.body.textContent);
            let words = textContent.split(/\s+|["':]/); // Split by whitespace characters
            
            const emailRegex = /\S+@\S+\.\S+/;
            let matchedEmails = words.filter((word) => !/\n/.test(word) && emailRegex.test(word) && word.length <= 200);
        
            for (const email of matchedEmails) {
                returnArray.push(email)
            }
        
            let emails = "";
            try {
                let aS = await page.$$("a")
                for (let i = 0; i < aS.length; i++) {
                    const href = await aS[i].getProperty("href")
                    const hrefValue = await href.jsonValue();
                    if (hrefValue.includes("contact")) {
                        const button = aS[i];
                        let cond = true;
                        await button.click().then(() => {
                            cond = false;
                        }).catch(() => {
                            cond = true;
                        })
                        if (cond) {
                            continue;
                        }
                        else {
                            break;
                        }
                    }
                }
                
                // await new Promise((resolve) => setTimeout(resolve, 2000));
        
                textContent = await page.evaluate(() => document.body.textContent);
                // Split by whitespace characters
                words = textContent.split(/\s+|["':]/);
        
                matchedEmails = words.filter((word) => !/\n/.test(word) && emailRegex.test(word) && word.length <= 200);
        
                for (const email of matchedEmails) {
                    if (!email.includes("http")) {
                        returnArray.push(email)
                    }
                }
                
                for (let email of returnArray) {
                    emails += email + ", ";
                }
            }
            catch(error) {
                page.close()
                return ""
            }
            
            page.close()
            return emails;
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
        
            let text = "None Found"
            
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
        
                const dd = await page.waitForXPath("//dt[contains(text(), 'Contact Information')]/following-sibling::*[1]", { timeout: 10000 });
                text = await dd.evaluate(el => el.textContent);
                }
            catch(error) {
                await browser.close()
                return "None Found"
            }
        
            await browser.close()
            return text;
        }
    })

    socket.on("stop_running", () => {
        keepRunning = false;
        console.log("trying close")
    })
}) 

app.get("/", (req, res, next) => {
    res.write("hey")
    res.end();
})

server.listen("4000", () => {
    console.log("Server started")
})