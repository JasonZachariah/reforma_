import { useState } from 'react'
import './index.css'

function App() {
  const [name, setName] = useState('')

  const handleButtonClick = async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const elements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, a, span')
          elements.forEach(element => {
            element.style.color = 'red'
          })
        },
      })
    } catch (error) {
      console.error('Error executing script:', error)
    }
  }

  return (
    <div className="background-color-primary p-4">
      <h1 id="header" className="text-center text-lg mb-4 font-secondary">
        Reforma
      </h1>

      <input
        type="text"
        id="fname"
        name="firstname"
        placeholder="Your name.."
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full mb-4 p-2 border rounded"
      />

      <button
        id="clickedButton"
        onClick={handleButtonClick}
        className="w-full bg-primary text-white py-2 px-4 rounded hover:opacity-90 transition-opacity"
      >
        Click me
      </button>
    </div>
  )
}

export default App
