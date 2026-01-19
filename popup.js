const clickedButton = document.getElementById('clickedButton');
const textbox = document.getElementById('textbox_id').value;

console.log(textbox);

function injectedFunction() {
  const divs  = document.querySelectorAll('div');

divs.forEach(div => {
  div.style.backgroundColor = "orange";
});
}

clickedButton.addEventListener('click', async () => {

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
      target : {tabId : tab.id},
      func : injectedFunction,
    });
  


});