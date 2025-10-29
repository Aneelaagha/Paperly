const summarizeText = document.getElementById("summary");

summarizeText.addEventListener("click", () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {type: "PAPERLY_SUMMARIZE"});
    });
});