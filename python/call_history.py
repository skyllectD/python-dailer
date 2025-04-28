#!/usr/bin/env python3
import json
import os
import time

class CallHistoryManager:
    """
    Manages call history records.
    Handles storage, retrieval, and filtering of call history.
    """
    def __init__(self, history_file="call_history.json"):
        self.history_file = history_file
        self.history = []
        self.load_history()
    
    def load_history(self):
        """Load call history from file or create empty if not exists"""
        try:
            if os.path.exists(self.history_file):
                with open(self.history_file, 'r') as f:
                    self.history = json.load(f)
            else:
                self.history = []
        except Exception as e:
            print(f"Error loading call history: {str(e)}")
            self.history = []
    
    def save_history(self):
        """Save call history to file"""
        try:
            with open(self.history_file, 'w') as f:
                json.dump(self.history, f, indent=2)
        except Exception as e:
            print(f"Error saving call history: {str(e)}")
    
    def add_call(self, call_data):
        """
        Add a new call to history
        
        call_data should be a dict with:
        - number: The phone number or SIP URI
        - type: 'incoming', 'outgoing', or 'missed'
        - timestamp: ISO format timestamp
        - duration: Call duration in seconds (0 for missed calls)
        """
        # Ensure required fields are present
        required_fields = ['number', 'type', 'timestamp']
        for field in required_fields:
            if field not in call_data:
                raise ValueError(f"Missing required field: {field}")
        
        # Set default duration for missed calls
        if call_data['type'] == 'missed' and 'duration' not in call_data:
            call_data['duration'] = 0
        elif 'duration' not in call_data:
            call_data['duration'] = 0
        
        # Add call to history
        self.history.insert(0, call_data)  # Add at the beginning (newest first)
        
        # Save to file
        self.save_history()
        
        return call_data
    
    def update_call_duration(self, number, duration):
        """Update the duration of the most recent call with the given number"""
        # Find the most recent call with the given number
        for call in self.history:
            if call['number'] == number:
                call['duration'] = duration
                self.save_history()
                return True
        
        return False
    
    def get_history(self, filter_type=None):
        """
        Get call history, optionally filtered by type
        
        filter_type can be:
        - None or 'all': Return all calls
        - 'incoming': Return only incoming calls
        - 'outgoing': Return only outgoing calls
        - 'missed': Return only missed calls
        """
        if not filter_type or filter_type == 'all':
            return self.history
        
        # Filter by call type
        return [call for call in self.history if call['type'] == filter_type]
    
    def clear_history(self):
        """Clear the entire call history"""
        self.history = []
        self.save_history()
        return True

def test_call_history():
    """Test function for call history"""
    manager = CallHistoryManager("test_history.json")
    
    # Add some test calls
    test_calls = [
        {
            'number': '1234567890',
            'type': 'outgoing',
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'duration': 120
        },
        {
            'number': '0987654321',
            'type': 'incoming',
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'duration': 45
        },
        {
            'number': '5555555555',
            'type': 'missed',
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S')
        }
    ]
    
    for call in test_calls:
        manager.add_call(call)
    
    # Print all history
    print("All calls:")
    for call in manager.get_history():
        print(f"{call['type']} call from {call['number']}, duration: {call['duration']}s")
    
    # Filter by type
    print("\nMissed calls:")
    for call in manager.get_history('missed'):
        print(f"Missed call from {call['number']}")
    
    # Update duration
    manager.update_call_duration('1234567890', 180)
    print("\nAfter updating duration:")
    for call in manager.get_history():
        if call['number'] == '1234567890':
            print(f"Call to {call['number']} now has duration: {call['duration']}s")
    
    # Clear history
    manager.clear_history()
    print("\nAfter clearing history:")
    print(f"Number of calls: {len(manager.get_history())}")

if __name__ == "__main__":
    test_call_history()