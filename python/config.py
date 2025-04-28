#!/usr/bin/env python3
import json
import os

class Config:
    """
    Handles configuration settings for the softphone.
    Stores and retrieves configuration from a JSON file.
    """
    def __init__(self, config_file="softphone_config.json"):
        self.config_file = config_file
        self.config = {
            'sip': {
                'username': '',
                'password': '',
                'domain': '',
                'proxy': ''
            },
            'audio': {
                'input_device': None,
                'output_device': None
            },
            'ui': {
                'theme': 'light',
                'compact_mode': False
            },
            'advanced': {
                'log_level': 'info'
            }
        }
        self.load_config()
    
    def load_config(self):
        """Load configuration from file or create default if not exists"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r') as f:
                    loaded_config = json.load(f)
                    # Merge loaded config with default config to ensure all required fields exist
                    self._deep_update(self.config, loaded_config)
            else:
                # Save default config
                self.save_config()
        except Exception as e:
            print(f"Error loading config: {str(e)}")
            # Keep default config
    
    def save_config(self, config=None):
        """Save configuration to file"""
        try:
            if config:
                self._deep_update(self.config, config)
            
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            print(f"Error saving config: {str(e)}")
    
    def get_config(self):
        """Get the entire configuration"""
        return self.config
    
    def get_sip_settings(self):
        """Get SIP account settings"""
        return self.config['sip']
    
    def save_sip_settings(self, settings):
        """Save SIP account settings"""
        self.config['sip'].update(settings)
        self.save_config()
        return self.config['sip']
    
    def get_audio_settings(self):
        """Get audio device settings"""
        return self.config['audio']
    
    def save_audio_settings(self, settings):
        """Save audio device settings"""
        self.config['audio'].update(settings)
        self.save_config()
        return self.config['audio']
    
    def get_ui_settings(self):
        """Get UI settings"""
        return self.config['ui']
    
    def save_ui_settings(self, settings):
        """Save UI settings"""
        self.config['ui'].update(settings)
        self.save_config()
        return self.config['ui']
    
    def get_advanced_settings(self):
        """Get advanced settings"""
        return self.config['advanced']
    
    def save_advanced_settings(self, settings):
        """Save advanced settings"""
        self.config['advanced'].update(settings)
        self.save_config()
        return self.config['advanced']
    
    def _deep_update(self, d, u):
        """Deep update a nested dictionary with another dictionary"""
        for k, v in u.items():
            if isinstance(v, dict) and k in d and isinstance(d[k], dict):
                self._deep_update(d[k], v)
            else:
                d[k] = v

def test_config():
    """Test function for config"""
    config = Config("test_config.json")
    
    # Print initial config
    print("Initial config:")
    print(json.dumps(config.get_config(), indent=2))
    
    # Change SIP settings
    print("\nChanging SIP settings...")
    sip_settings = {
        'username': 'test_user',
        'password': 'test_pass',
        'domain': 'sip.example.com'
    }
    config.save_sip_settings(sip_settings)
    
    # Change audio settings
    print("\nChanging audio settings...")
    audio_settings = {
        'input_device': 1,
        'output_device': 0
    }
    config.save_audio_settings(audio_settings)
    
    # Print updated config
    print("\nUpdated config:")
    print(json.dumps(config.get_config(), indent=2))

if __name__ == "__main__":
    test_config()