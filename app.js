// Settings modal functions
function openSettings() {
    const modal = document.getElementById('settingsModal');
    const apiKey = localStorage.getItem('openai_api_key') || '';
    document.getElementById('apiKey').value = apiKey;
    modal.style.display = 'block';
}

function closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
}

function saveSettings() {
    const apiKey = document.getElementById('apiKey').value.trim();
    if (apiKey) {
        localStorage.setItem('openai_api_key', apiKey);
        closeSettings();
    } else {
        document.getElementById('error').textContent = 'Please enter an API key';
    }
}

// Check if API key exists, if not show settings modal
if (!localStorage.getItem('openai_api_key')) {
    openSettings();
}

// Check for prompt in query string
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('prompt')) {
    document.getElementById('prompt').value = urlParams.get('prompt');
    generateEvent(); // Auto-generate if prompt is provided
}

async function generateEvent() {
    const apiKey = localStorage.getItem('openai_api_key');
    const prompt = document.getElementById('prompt').value.trim();
    const errorDiv = document.getElementById('error');

    if (!apiKey) {
        errorDiv.textContent = 'Please configure your OpenAI API key in settings';
        openSettings();
        return;
    }

    if (!prompt) {
        errorDiv.textContent = 'Please enter an event description';
        return;
    }

    errorDiv.textContent = '';

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [{
                    role: "system",
                    content: "You are a helpful assistant that extracts calendar event details from natural language descriptions. For the response: 1) Convert relative dates (like 'next Tuesday') to actual calendar dates (e.g., '2024-01-23'). 2) For times, use 24-hour format (e.g., '14:00'). 3) Combine date and time into ISO 8601 format (e.g., '2024-01-23T14:00:00Z'). 4) Return a JSON object with: title (string), description (string), startDate (ISO 8601 string), endDate (ISO 8601 string), and location (string). 5) For duration-based events (like '1 hour'), calculate the endDate by adding the duration to startDate. 6) When a due date or deadline is mentioned, use it as the endDate and calculate startDate based on context (default to 23 hours and 59 minutes before if no duration given). Example output: {\"title\": \"Project Deadline\", \"description\": \"Complete Q4 report\", \"startDate\": \"2024-01-23T13:00:00Z\", \"endDate\": \"2024-01-23T14:00:00Z\", \"location\": \"Office\"}"
                }, {
                    role: "user",
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        let eventData;
        try {
            eventData = JSON.parse(data.choices[0].message.content);

            // Validate dates
            if (eventData.startDate) {
                const startDate = new Date(eventData.startDate);
                if (isNaN(startDate.getTime())) {
                    throw new Error('Invalid start date format');
                }
                eventData.startDate = startDate.toISOString();
            }

            if (eventData.endDate) {
                const endDate = new Date(eventData.endDate);
                if (isNaN(endDate.getTime())) {
                    throw new Error('Invalid end date format');
                }
                eventData.endDate = endDate.toISOString();
            }

            // Populate form fields
            document.getElementById('title').value = eventData.title || '';
            document.getElementById('description').value = eventData.description || '';
            document.getElementById('startDate').value = eventData.startDate ? eventData.startDate.slice(0, 16) : '';
            document.getElementById('endDate').value = eventData.endDate ? eventData.endDate.slice(0, 16) : '';
            document.getElementById('location').value = eventData.location || '';
        } catch (parseError) {
            throw new Error('Failed to parse event data: ' + parseError.message);
        }

        // Show event details section
        document.getElementById('eventDetails').style.display = 'block';
    } catch (error) {
        errorDiv.textContent = 'Error: ' + error.message;
    }
}

function downloadICS() {
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const startDate = new Date(document.getElementById('startDate').value);
    const endDate = new Date(document.getElementById('endDate').value);
    const location = document.getElementById('location').value;

    if (!title || !startDate || !endDate) {
        document.getElementById('error').textContent = 'Please fill in at least the title, start date, and end date';
        return;
    }

    // Format dates for ICS
    const formatDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').slice(0, -5) + 'Z';
    };

    const escapeText = (text) => {
        return text.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
    };

    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Calendar Event Generator//EN',
        'BEGIN:VEVENT',
        `UID:${new Date().getTime()}@calendareventgenerator`,
        `DTSTAMP:${formatDate(new Date())}`,
        `DTSTART:${formatDate(startDate)}`,
        `DTEND:${formatDate(endDate)}`,
        `SUMMARY:${escapeText(title)}`,
        description ? `DESCRIPTION:${escapeText(description)}` : '',
        location ? `LOCATION:${escapeText(location)}` : '',
        'END:VEVENT',
        'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'event.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
