// Global state
let activeCalls = {};
let conferenceCalls = []; // New array for conference calls
let activeCallId = null;
let isMuted = false;
let isOnHold = false;
let callDurationInterval = null;
let callStartTime = 0;
let contactBeingEdited = null;
const screenHistory = [];

// Wait for DOM to be loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize event listeners and setup
    initializeEventListeners();
    initializePythonCommunication();
    document.getElementById('back-button').style.display = screenHistory.length > 0 ? 'block' : 'none';

});

function initializeEventListeners() {
    // Dialer screen
    document.querySelectorAll('.dialpad-btn').forEach(button => {
        button.addEventListener('click', () => {
            const digit = button.getAttribute('data-digit');
            const phoneNumberInput = document.getElementById('phone-number');
            phoneNumberInput.value += digit;
        });
    });

    document.getElementById('call-btn').addEventListener('click', async () => {
        const phoneNumber = document.getElementById('phone-number').value.trim();
        if (phoneNumber) {
            makeCall(phoneNumber);
            document.getElementById('dialer-screen').classList.remove('active');
            document.getElementById('call-screen').classList.add('active');


        } else {
            showStatusMessage('Please enter a phone number');
        }
    });

    // Call screen
    document.getElementById('hangup-btn').addEventListener('click', () => {
        hangupAllCall();
        document.getElementById('call-screen').classList.remove('active');
        document.getElementById('dialer-screen').classList.add('active');

    });

    document.getElementById('mute-btn').addEventListener('click', () => {
        toggleMute();
    });

    document.getElementById('hold-btn').addEventListener('click', () => {
        toggleHold();
    });

    document.getElementById('merge-btn').addEventListener('click', () => {
        mergeActiveCalls();
    });

    // Incoming call screen
    document.getElementById('answer-btn').addEventListener('click', () => {
        const incomingCallId = document.getElementById('incoming-call-screen').dataset.callId;
        if (incomingCallId) {
            answerCall(incomingCallId);
        }
    });

    document.getElementById('open-dialer-btn').addEventListener('click', () => {
        document.getElementById('dialer-screen').classList.add('active');
    });

    document.getElementById('reject-btn').addEventListener('click', () => {
        const incomingCallId = document.getElementById('incoming-call-screen').dataset.callId;
        if (incomingCallId) {
            hangupCall(incomingCallId);
            delete activeCalls[incomingCallId];
        }

        // If no active calls remain, reset the UI and show the dialer screen
        if (Object.keys(activeCalls).length === 0) {
            activeCallId = null;
            resetCallUI();
            showScreen('dialer-screen');
        } else {
            // If there are still active calls, switch to the first active call
            activeCallId = Object.keys(activeCalls)[0];
            updateCallUI(activeCalls[activeCallId].state, activeCalls[activeCallId].number);
            showScreen('call-screen');
        }
    });

    // SIP Settings
    document.getElementById('save-sip-btn').addEventListener('click', () => {
        saveSipSettings();
    });

    document.getElementById('register-sip-btn').addEventListener('click', () => {
        registerSip();
    });

    document.getElementById('unregister-sip-btn').addEventListener('click', () => {
        unregisterSip();
    });

    document.getElementById('back-from-sip-btn').addEventListener('click', () => {
        showScreen('dialer-screen');
    });

    // Audio Settings
    document.getElementById('save-audio-btn').addEventListener('click', () => {
        saveAudioSettings();
    });

    document.getElementById('test-audio-btn').addEventListener('click', () => {
        testAudio();
    });

    document.getElementById('back-from-audio-btn').addEventListener('click', () => {
        showScreen('dialer-screen');
    });

    // Contacts
    document.getElementById('add-contact-btn').addEventListener('click', () => {
        document.getElementById('contact-form-title').textContent = 'Add Contact';
        document.getElementById('contact-name').value = '';
        document.getElementById('contact-number').value = '';
        document.getElementById('contact-email').value = '';
        document.getElementById('contact-form-dialog').classList.add('active');
        contactBeingEdited = null;
    });

    document.getElementById('save-contact-btn').addEventListener('click', () => {
        saveContact();
    });

    document.getElementById('cancel-contact-btn').addEventListener('click', () => {
        document.getElementById('contact-form-dialog').classList.remove('active');
    });

    document.getElementById('contacts-search').addEventListener('input', (e) => {
        filterContacts(e.target.value);
    });

    document.getElementById('back-from-contacts-btn').addEventListener('click', () => {
        showScreen('dialer-screen');
    });

    // Call History
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filterCallHistory(btn.getAttribute('data-filter'));
        });
    });

    document.getElementById('clear-history-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear call history?')) {
            clearCallHistory();
        }
    });

    document.getElementById('back-from-history-btn').addEventListener('click', () => {
        showScreen('dialer-screen');
    });

    // About
    document.getElementById('back-from-about-btn').addEventListener('click', () => {
        showScreen('dialer-screen');
    });
}

function initializePythonCommunication() {

    window.electronAPI.runPython(['arg1', 'arg2']).then(response => {
        console.log('Python response:', response);
    });

    // Listen for messages from Python backend
    window.electronAPI.onFromPython((data) => {

        const match = data.match(/{.*}/s);

        if (match) {
            try {
                data = JSON.parse(match[0]);
            } catch (error) {
                return;
            }
        } else {
            return;
        }


        // Check if data and type are valid
        // if (typeof data == 'string') {
        //     try {
        //         data = JSON.parse(data);
        //     } catch (e) {
        //         return;
        //     }
        // }

        const messageType = data.type;
        switch (messageType) {
            case 'registration_state':
                updateRegistrationState(data);
                break;
            case 'call_state':
                updateCallState(data);
                break;
            case 'incoming_call':
                handleIncomingCall(data);
                activeCallId = data.id;
                break;
            case 'call_ended':
                handleCallEnded(data);
                break;
            case 'audio_devices':
                updateAudioDevices(data);
                break;
            case 'audio_test':
                if (data.status === 'playing') {
                    showStatusMessage('Playing test audio...');
                } else if (data.status === 'completed') {
                    showStatusMessage('Audio test completed');
                }
                break;
            case 'call_history':
                updateCallHistory(data);
                break;
            case 'contacts':
                updateContacts(data);
                break;
            case 'contact_search_results':
                updateContacts({ contacts: data.results });
                break;
            case 'sip_settings':
                document.getElementById('sip-username').value = data.settings.username || '';
                document.getElementById('sip-password').value = data.settings.password || '';
                document.getElementById('sip-domain').value = data.settings.domain || '';
                document.getElementById('sip-proxy').value = data.settings.proxy || '';
                break;
            case 'audio_settings':
                const inputSelect = document.getElementById('input-device');
                const outputSelect = document.getElementById('output-device');
                if (inputSelect.options.length > 0 && data.settings.input_device !== null) {
                    inputSelect.value = data.settings.input_device;
                }
                if (outputSelect.options.length > 0 && data.settings.output_device !== null) {
                    outputSelect.value = data.settings.output_device;
                }
                break;
            case 'call_init':
                // Capture the call_id from the backend
                const callId = data.id; // Capture the call ID
                activeCallId = callId;
                break;
            case 'error':
                showStatusMessage(`Error: ${data.message}`);
                break;
            case 'conference_state':
                conferenceCalls = data
                updateConferenceState(conferenceCalls);
                showStatusMessage(data.message || 'Conference call active');
                break;
            case 'call_mute_state':
                showStatusMessage(data.message || (data.muted ? 'Call muted' : 'Call unmuted'));
                break;
            case 'call_hold_state':
                showStatusMessage(data.message || (data.on_hold ? 'Call on hold' : 'Call resumed'));
                break;
        }
    });

    // Listen for Python errors
    window.electronAPI.onPythonError((data) => {
        console.error('Python error:', data);
        showError(data);
    });

    // Listen for menu events
    window.electronAPI.onShowSipSettings(() => {
        loadSipSettings();
        showScreen('sip-settings-screen');
    });

    window.electronAPI.onShowAudioSettings(() => {
        requestAudioDevices();
        showScreen('audio-settings-screen');
    });

    window.electronAPI.onShowContacts(() => {
        requestContacts();
        showScreen('contacts-screen');
    });

    window.electronAPI.onShowCallHistory(() => {
        requestCallHistory();
        showScreen('call-history-screen');
    });

    window.electronAPI.onShowAbout(() => {
        showScreen('about-screen');
    });

    // Request initial state
    requestAudioDevices();
}

function loadSipSettings() {
    window.electronAPI.sendToPython({ type: 'get_sip_settings' });
}

function saveSipSettings() {
    const username = document.getElementById('sip-username').value.trim();
    const password = document.getElementById('sip-password').value.trim();
    const domain = document.getElementById('sip-domain').value.trim();
    const proxy = document.getElementById('sip-proxy').value.trim();

    if (!username || !password || !domain) {
        showStatusMessage('Please fill all required fields');
        return;
    }

    window.electronAPI.sendToPython({
        type: 'register_sip',
        username,
        password,
        domain,
        proxy
    });

    showStatusMessage('SIP settings saved');
}

function registerSip() {
    const username = document.getElementById('sip-username').value.trim();
    const password = document.getElementById('sip-password').value.trim();
    const domain = document.getElementById('sip-domain').value.trim();
    const proxy = document.getElementById('sip-proxy').value.trim();

    if (!username || !password || !domain) {
        showStatusMessage('Please fill all required fields');
        return;
    }

    window.electronAPI.sendToPython({
        type: 'register_sip',
        username,
        password,
        domain,
        proxy
    });

    showStatusMessage('Registering SIP account...');
}

function unregisterSip() {
    window.electronAPI.sendToPython({ type: 'unregister_sip' });
    showStatusMessage('Unregistering SIP account...');
}

function updateRegistrationState(data) {
    const statusElement = document.getElementById('registration-status');
    if (data.registered) {
        statusElement.textContent = 'Registered';
        statusElement.classList.add('registered');
        showStatusMessage('SIP account registered');
    } else {
        statusElement.textContent = 'Not Registered';
        statusElement.classList.remove('registered');
        showStatusMessage('SIP account not registered');
    }
}

function makeCall(number) {
    console.log('callId', activeCallId);
    // Check if we're already in a call
    if (Object.keys(activeCalls).length > 0 && !confirm('You already have an active call. Make another call?')) {
        return;
    }

    // Added logging to debug communication
    console.log(`Sending call request to Python for number: ${number}`);

    window.electronAPI.sendToPython({
        command: 'make_call',
        number: number
    });

    console.log('Active call ID:', activeCallId);

    showStatusMessage(`Calling ${number}...`);
}

function hangupCall(callId) {
    console.log(`Sending hangup request for call: ${callId}`);
    window.electronAPI.sendToPython({
        command: 'hangup_call',
        call_id: callId
    });
}

function hangupAllCall() {
    console.log(`Sending hangup request for call: All`);
    window.electronAPI.sendToPython({
        command: 'hangup_call',
        call_id: 'all'
    });
}

function answerCall(callId) {
    console.log(`Sending answer request for call: ${callId}`);
    window.electronAPI.sendToPython({
        command: 'answer_call',
        call_id: callId
    });

    // Hide incoming call screen and show call screen
    showScreen('call-screen');
}

function toggleMute() {
    if (!activeCallId) return;

    isMuted = !isMuted;
    const muteBtn = document.getElementById('mute-btn');
    muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
    muteBtn.classList.toggle('active', isMuted);

    window.electronAPI.sendToPython({
        command: 'set_mute',
        call_id: activeCallId,
        muted: isMuted
    });

    showStatusMessage(isMuted ? 'Call muted' : 'Call unmuted');
}

function toggleHold() {
    if (!activeCallId) return;

    isOnHold = !isOnHold;
    const holdBtn = document.getElementById('hold-btn');
    holdBtn.textContent = isOnHold ? 'Unhold' : 'Hold';
    holdBtn.classList.toggle('active', isOnHold);

    window.electronAPI.sendToPython({
        command: 'set_hold',
        call_id: activeCallId,
        on_hold: isOnHold
    });

    showStatusMessage(isOnHold ? 'Call on hold' : 'Call resumed');
}

function mergeActiveCalls() {
    const callIds = Object.keys(activeCalls);
    if (callIds.length < 2) {
        showStatusMessage('Need at least two calls to create a conference');
        return;
    }

    window.electronAPI.sendToPython({
        command: 'setup_conference',
        call_ids: callIds
    });

    showStatusMessage('Setting up conference call...');
}

function handleIncomingCall(data) {
    const callId = data.id;
    const callerNumber = data.number;

    // Add to active calls
    activeCalls[callId] = {
        number: callerNumber,
        state: 'incoming'
    };

    console.log('--------------activeCalls-11111111', activeCalls)
    // Update UI
    document.getElementById('incoming-number').textContent = callerNumber;
    document.getElementById('incoming-call-screen').dataset.callId = callId;

    // Show incoming call screen
    showScreen('incoming-call-screen');
}

function updateConferenceState(data) {
    const conferenceList = document.getElementById('conference-call-list');
    const activeCallsList = document.getElementById('active-calls-list');
    conferenceList.innerHTML = '';

    if (data && data.hasOwnProperty('calls') && (!data.calls || data.calls.length === 0)) {
        conferenceCalls = {}; // Clear conference calls
        conferenceList.innerHTML = '<div class="empty-list">No active conference calls</div>';
        activeCallsList.style.display = '';
        return;
    }

    conferenceCalls = data; // Update conference calls array// activeCalls = null;
    activeCallsList.style.display = 'none';
    conferenceList.style.display = 'block';
    const groupName = document.createElement('div');
    groupName.className = 'conference-group-name';
    groupName.textContent = `Group Name: ${data.group_name || 'Unnamed Group'}`;
    conferenceList.appendChild(groupName);

    data.calls.forEach(call => {
        const callItem = document.createElement('div');
        callItem.innerHTML = `
            <div class="list-item-info">
                <div class="d-flex flex-column">
                    <span class="call-item-number">${call.number}</span>
                        <span class="call-item-details">
                            <span class="call-state">${call.state}</span>
                        </span>
                   </div>
                
                <button class="end-call-btn">End</button>
            </div>
        `;
        callItem.className = 'list-item';
        callItem.querySelector('.end-call-btn').addEventListener('click', () => {
            hangupCall(call.id);
        });
        conferenceList.appendChild(callItem);
    });

    showStatusMessage('Conference call updated');
}

function mergeCallToConference(callId) {
    window.electronAPI.sendToPython({
        command: 'setup_conference',
        call_ids: [...Object.keys(activeCalls), callId]
    });
    showStatusMessage('Merging call into conference...');
}

function updateCallState(data) {
    const callId = data.id;
    const state = data.state.toLowerCase();
    const number = data.number || '(Unknown)';

    // Update or add the call in activeCalls
    if (!activeCalls[callId]) {
        activeCalls[callId] = {
            number: number || '(Unknown)',
            state: state
        };
    } else {
        activeCalls[callId].state = state;
        if (number) {
            activeCalls[callId].number = number;
        }
    }

    if (
        conferenceCalls &&
        Array.isArray(conferenceCalls.calls) &&
        conferenceCalls.calls.length > 0 &&
        conferenceCalls.calls.some(call => call.id === callId)
    ) {
        delete activeCalls[callId];
    }


    // Update the active call and UI if necessary
    if (!activeCallId || callId === activeCallId) {
        activeCallId = callId;
        updateCallUI(state, number);
    }

    // Handle call state transitions
    if (state === 'confirmed') {
        callStartTime = Date.now();
        toggleBackButtonForActiveCall(true);
        startCallDurationTimer();
    } else if (state == 'disconnctd') {
        toggleBackButtonForActiveCall(false); // Hide back button
        handleDisconnectedCall(callId);
    } else if (['connected', 'dialing', 'ringing'].includes(state)) {
        showScreen('call-screen');
        toggleBackButtonForActiveCall(true); // Show back button
    }

    // Update active calls list and controls
    updateActiveCallsUI();
}

function updateCallUI(state, number) {
    document.getElementById('call-status').textContent = capitalizeFirstLetter(state);
    document.getElementById('call-number').textContent = number;
}

function handleDisconnectedCall(callId) {
    delete activeCalls[callId];
    console.log('---------2222222222', conferenceCalls)
    if (Array.isArray(conferenceCalls?.calls)) {
        conferenceCalls.calls = conferenceCalls.calls.filter(call => call.id !== callId);

        if (conferenceCalls?.calls.length > 1) {
            updateConferenceState(conferenceCalls);
        } else if (conferenceCalls?.calls.length === 1) {
            const activeCall = conferenceCalls?.calls?.[0];
            activeCalls = [activeCall];
            conferenceCalls = [];
            activeCallId = activeCall?.id || activeCalls[0]?.id;
            document.getElementById('call-status').textContent = capitalizeFirstLetter('Confirmed');
            document.getElementById('call-number').textContent = activeCall?.number || '';
            showScreen('call-screen');
        }
    }

    console.log('Call disconnected. Remaining active calls:', activeCalls);

    if (Object.keys(activeCalls).length === 0) {
        resetCallUI();
        showScreen('dialer-screen');
    } else {
        const nextCallId = Object.keys(activeCalls)[0];
        activeCallId = nextCallId;
        updateCallUI(activeCalls[nextCallId].state, activeCalls[nextCallId].number);
    }
}

function handleCallEnded(data) {
    const callId = data.call_id;

    // Remove from active calls
    if (activeCalls[callId]) {
        delete activeCalls[callId];
    }

    console.log('-1111111111111111---------------', conferenceCalls)
    conferenceCalls.calls = conferenceCalls?.calls.filter(call => call.id !== callId);

    // If this was the active call, update UI
    if (callId === activeCallId) {
        // Clear call data
        if (Object.keys(activeCalls).length > 0) {
            // Switch to another active call
            activeCallId = Object.keys(activeCalls)[0];
            document.getElementById('call-status').textContent = capitalizeFirstLetter(activeCalls[activeCallId].state);
            document.getElementById('call-number').textContent = activeCalls[activeCallId].number;
        } else {
            // No more active calls
            resetCallUI();
            showScreen('dialer-screen');
        }
    }

    // Update active calls list
    updateActiveCallsUI();

    // Update call controls based on active calls
    // updateCallControls(Object.keys(activeCalls).length > 0);
}

function resetCallUI() {
    document.getElementById('call-status').textContent = 'Dialing...';
    document.getElementById('call-number').textContent = '(No Number)';
    document.getElementById('call-duration').textContent = '00:00';
    document.getElementById('mute-btn').textContent = 'Mute';
    document.getElementById('hold-btn').textContent = 'Hold';
    document.getElementById('mute-btn').classList.remove('active');
    document.getElementById('hold-btn').classList.remove('active');
    isMuted = false;
    isOnHold = false;
    activeCallId = null;
    callStartTime = 0;
    if (callDurationInterval) {
        clearInterval(callDurationInterval);
        callDurationInterval = null;
    }
}

// function updateCallControls(hasActiveCall) {
//     const mergeBtn = document.getElementById('merge-btn');
//     mergeBtn.disabled = Object.keys(activeCalls).length < 2;
// }

function updateActiveCallsUI() {
    const activeCallsList = document.getElementById('active-calls-list');
    const conferenceList = document.getElementById('conference-call-list');
    activeCallsList.innerHTML = '';

    conferenceList.style.display = 'none';

    for (const [callId, call] of Object.entries(activeCalls)) {
        const callItem = document.createElement('div');
        callItem.className = `${callId === activeCallId ? 'active-call-selected' : ''}`;
        callItem.dataset.callId = callId;
        // Show Switch and End buttons for active calls
        const showMerge = callId == activeCallId && Array.isArray(conferenceCalls?.calls) && conferenceCalls?.calls.some(confCall => confCall.id !== callId);
        const mergeButtonClass = showMerge ? 'merge-btn visible' : 'merge-btn hidden';

        // Show Switch button only if this is NOT the active call
        const switchButtonClass = callId !== activeCallId ? 'visible' : 'hidden';

        callItem.innerHTML = `
            <div class="call-item-container">
                <div class="call-item-info">
                    <span class="call-item-number">${call.number}</span>
                </div>
                <div class="call-item-actions">
                    <button class="switch-call-btn ${switchButtonClass}">Switch</button>
                    <button class="end-call-btn">End</button>
                    <button class="action-btn ${mergeButtonClass}">Merge</button>
                </div>
            </div>`;


        callItem.querySelector('.merge-btn').addEventListener('click', () => {
            mergeCallToConference(callId);
        });

        callItem.querySelector('.switch-call-btn').addEventListener('click', () => {
            switchToCall(callId);
        });

        callItem.querySelector('.end-call-btn').addEventListener('click', () => {
            hangupCall(callId);
        });

        activeCallsList.appendChild(callItem);
    }
    activeCallsList.style.display = Object.keys(activeCalls).length > 1 ? '' : 'none';
}

function switchToCall(callId) {
    if (activeCalls[callId]) {
        activeCallId = callId;
        document.getElementById('call-status').textContent = capitalizeFirstLetter(activeCalls[callId].state);
        document.getElementById('call-number').textContent = activeCalls[callId].number;

        // Update active calls UI to show the new selection
        updateActiveCallsUI();

        // Update controls (mute/hold status) based on the selected call
        // In a real implementation, you would get the actual state from the backend
        isMuted = false;
        isOnHold = false;
        document.getElementById('mute-btn').textContent = 'Mute';
        document.getElementById('hold-btn').textContent = 'Hold';
        document.getElementById('mute-btn').classList.remove('active');
        document.getElementById('hold-btn').classList.remove('active');

        window.electronAPI.sendToPython({
            command: 'switch_call',
            call_id: callId
        });
    }
}

function startCallDurationTimer() {
    if (callDurationInterval) {
        clearInterval(callDurationInterval);
    }

    callDurationInterval = setInterval(() => {
        if (!callStartTime) return;

        const durationMs = Date.now() - callStartTime;
        const durationSec = Math.floor(durationMs / 1000);
        const minutes = Math.floor(durationSec / 60);
        const seconds = durationSec % 60;
        document.getElementById('call-duration').textContent =
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function requestAudioDevices() {
    window.electronAPI.sendToPython({ command: 'get_audio_devices' });
    window.electronAPI.sendToPython({ command: 'get_audio_settings' });
}

function updateAudioDevices(data) {
    const inputSelect = document.getElementById('input-device');
    const outputSelect = document.getElementById('output-device');

    // Clear existing options
    inputSelect.innerHTML = '';
    outputSelect.innerHTML = '';

    // Add input devices
    data.devices.input.forEach(device => {
        const option = document.createElement('option');
        option.value = device.id;
        option.textContent = device.name;
        inputSelect.appendChild(option);
    });

    // Add output devices
    data.devices.output.forEach(device => {
        const option = document.createElement('option');
        option.value = device.id;
        option.textContent = device.name;
        outputSelect.appendChild(option);
    });
}

function saveAudioSettings() {
    const inputDevice = document.getElementById('input-device').value;
    const outputDevice = document.getElementById('output-device').value;

    window.electronAPI.sendToPython({
        command: 'set_audio_devices',
        input_device: parseInt(inputDevice),
        output_device: parseInt(outputDevice)
    });

    showStatusMessage('Audio settings saved');
}

function testAudio() {
    window.electronAPI.sendToPython({ command: 'test_audio' });
}

function requestCallHistory() {
    window.electronAPI.sendToPython({ command: 'get_call_history' });
}

function updateCallHistory(data) {
    const historyList = document.getElementById('call-history-list');
    historyList.innerHTML = '';

    if (!data.history || data.history.length === 0) {
        historyList.innerHTML = '<div class="empty-list">No call history</div>';
        return;
    }

    data.history.forEach(call => {
        const callItem = document.createElement('div');
        callItem.className = 'list-item';

        // Format date and time
        const date = new Date(call.timestamp);
        const formattedDate = date.toLocaleDateString();
        const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Format duration
        const duration = formatDuration(call.duration);

        // Set icon based on call type
        let icon = '';
        let typeClass = '';
        if (call.type === 'incoming') {
            icon = '↓';
            typeClass = 'incoming';
        } else if (call.type === 'outgoing') {
            icon = '↑';
            typeClass = 'outgoing';
        } else if (call.type === 'missed') {
            icon = '✕';
            typeClass = 'missed';
        }

        callItem.innerHTML = `
            <div class="list-item-info">
                <span class="call-item-number">${call.number}</span>
                <span class="call-item-details">
                    <span class="call-type ${typeClass}">${icon} ${capitalizeFirstLetter(call.type)}</span>
                    <span class="call-duration">${duration}</span>
                    <span class="call-timestamp">${formattedDate} ${formattedTime}</span>
                </span>
            </div>
            <div class="list-item-actions">
                <button class="call-btn" data-number="${call.number}">Call</button>
            </div>
        `;

        callItem.querySelector('.call-btn').addEventListener('click', () => {
            makeCall(call.number);
        });

        historyList.appendChild(callItem);
    });
}

function filterCallHistory(type) {
    window.electronAPI.sendToPython({
        command: 'get_call_history',
        filter_type: type
    });
}

function clearCallHistory() {
    window.electronAPI.sendToPython({ type: 'clear_call_history' });
}

function requestContacts() {
    window.electronAPI.sendToPython({ type: 'get_contacts' });
}

function updateContacts(data) {
    const contactsList = document.getElementById('contacts-list');
    contactsList.innerHTML = '';

    if (!data.contacts || data.contacts.length === 0) {
        contactsList.innerHTML = '<div class="empty-list">No contacts</div>';
        return;
    }

    data.contacts.forEach(contact => {
        const contactItem = document.createElement('div');
        contactItem.className = 'list-item';

        contactItem.innerHTML = `
            <div class="list-item-info">
                <span class="contact-name">${contact.name}</span>
                <span class="contact-details">
                    <span class="contact-number">${contact.number}</span>
                    ${contact.email ? `<span class="contact-email">${contact.email}</span>` : ''}
                </span>
            </div>
            <div class="list-item-actions">
                <button class="call-btn" data-number="${contact.number}">Call</button>
                <button class="edit-btn" data-id="${contact.id}">Edit</button>
                <button class="delete-btn" data-id="${contact.id}">Delete</button>
            </div>
        `;

        contactItem.querySelector('.call-btn').addEventListener('click', () => {
            makeCall(contact.number);
        });

        contactItem.querySelector('.edit-btn').addEventListener('click', () => {
            editContact(contact);
        });

        contactItem.querySelector('.delete-btn').addEventListener('click', () => {
            deleteContact(contact.id);
        });

        contactsList.appendChild(contactItem);
    });
}

function saveContact() {
    const name = document.getElementById('contact-name').value.trim();
    const number = document.getElementById('contact-number').value.trim();
    const email = document.getElementById('contact-email').value.trim();

    if (!name || !number) {
        showStatusMessage('Please fill all required fields');
        return;
    }

    const contactData = {
        name,
        number,
        email: email || undefined
    };

    // If editing an existing contact, include the ID
    if (contactBeingEdited) {
        contactData.id = contactBeingEdited.id;
    }

    window.electronAPI.sendToPython({
        type: 'save_contact',
        contact: contactData
    });

    document.getElementById('contact-form-dialog').classList.remove('active');
    showStatusMessage(contactBeingEdited ? 'Contact updated' : 'Contact added');
    contactBeingEdited = null;
}

function editContact(contact) {
    document.getElementById('contact-form-title').textContent = 'Edit Contact';
    document.getElementById('contact-name').value = contact.name;
    document.getElementById('contact-number').value = contact.number;
    document.getElementById('contact-email').value = contact.email || '';
    document.getElementById('contact-form-dialog').classList.add('active');
    contactBeingEdited = contact;
}

function deleteContact(contactId) {
    if (confirm('Are you sure you want to delete this contact?')) {
        window.electronAPI.sendToPython({
            type: 'delete_contact',
            contact_id: contactId
        });
        showStatusMessage('Contact deleted');
    }
}

function filterContacts(query) {
    if (!query) {
        requestContacts();
        return;
    }

    window.electronAPI.sendToPython({
        type: 'search_contacts',
        query
    });
}

function showError(data) {
    showStatusMessage(`Error: ${data.message}`);
}

// Helper functions
function showScreen(screenId) {
    screenHistory.push(screenId);
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

function showStatusMessage(message, duration = 3000) {
    const statusElement = document.getElementById('status-message');
    statusElement.textContent = message;
    statusElement.classList.add('active');

    setTimeout(() => {
        statusElement.classList.remove('active');
        statusElement.textContent = ''
    }, duration);
}

function capitalizeFirstLetter(string) {
    if (!string) return '';
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

window.electronAPI.onCallInit((callId) => {
    console.log('Received call_id from Python:', callId);
});

function toggleBackButtonForActiveCall(isActive) {
    const backButton = document.getElementById('back-button');
    // Show or hide the back button based on the call state
    backButton.style.display = isActive && screenHistory.length > 0 ? 'block' : 'none';
}

document.getElementById('back-button').addEventListener('click', () => {
    if (screenHistory.length > 0) {
        const previousScreenId = screenHistory.pop(); // Get the last screen
        showScreen(previousScreenId); // Navigate to the previous screen
    }
});
