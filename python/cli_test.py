#!/usr/bin/env python3
"""
CLI Test Script for Softphone Backend
This script provides a simple command-line interface to test the softphone backend.
"""

import json
import sys
import time
import threading
from softphone import SoftphoneBackend

class SoftphoneCLI:
    def __init__(self):
        self.backend = SoftphoneBackend()
        self.backend_thread = None
        self.running = False
        
        # Override backend's send_to_frontend to display messages on console
        self.backend.send_to_frontend = self.handle_backend_message
        
    def start(self):
        """Start the CLI interface"""
        print("Softphone CLI Test Interface")
        print("===========================")
        
        # Start backend in a separate thread
        self.running = True
        self.backend_thread = threading.Thread(target=self.backend_run)
        self.backend_thread.daemon = True
        self.backend_thread.start()
        
        # Display help
        self.print_help()
        
        # Main command loop
        while self.running:
            try:
                cmd = input("> ").strip().lower()
                self.process_command(cmd)
            except KeyboardInterrupt:
                print("\nExiting...")
                self.running = False
                break
            except Exception as e:
                print(f"Error: {str(e)}")
        
        # Shutdown backend
        self.backend.shutdown()
    
    def backend_run(self):
        """Run the backend in a thread"""
        try:
            # Override sys.stdin for the backend
            # Instead of reading from stdin, we'll send messages programmatically
            self.backend.send_registration_state()
            
            # Just sleep and let the main thread handle commands
            while self.running:
                time.sleep(0.1)
        except Exception as e:
            print(f"Backend error: {str(e)}")
    
    def handle_backend_message(self, message):
        """Handle messages from the backend"""
        print(f"\nBACKEND: {json.dumps(message, indent=2)}")
        print("> ", end="", flush=True)  # Restore prompt
    
    def send_to_backend(self, message):
        """Send a message to the backend"""
        try:
            self.backend.process_message(message)
        except Exception as e:
            print(f"Error sending message: {str(e)}")
    
    def process_command(self, cmd):
        """Process a CLI command"""
        if not cmd:
            return
        
        parts = cmd.split()
        command = parts[0]
        args = parts[1:]
        
        if command == 'help' or command == 'h':
            self.print_help()
        
        elif command == 'quit' or command == 'q' or command == 'exit':
            print("Exiting...")
            self.running = False
        
        elif command == 'reg' or command == 'register':
            username = input("Username: ")
            password = input("Password: ")
            domain = input("Domain: ")
            proxy = input("Proxy (optional): ")
            
            self.send_to_backend({
                'type': 'register_sip',
                'username': username,
                'password': password,
                'domain': domain,
                'proxy': proxy
            })
        
        elif command == 'unreg' or command == 'unregister':
            self.send_to_backend({'type': 'unregister_sip'})
        
        elif command == 'call':
            if not args:
                number = input("Number to call: ")
            else:
                number = args[0]
            
            self.send_to_backend({
                'type': 'make_call',
                'number': number
            })
        
        elif command == 'answer':
            print("===============args",args)
            if not args:
                print("Usage: answer <call_id>")
                return
            
            self.send_to_backend({
                'type': 'answer_call',
                'call_id': args[0]
            })
        
        elif command == 'hangup':
            if not args:
                print("Usage: hangup <call_id>")
                return
            
            self.send_to_backend({
                'type': 'hangup_call',
                'call_id': args[0]
            })
        
        elif command == 'mute':
            if not args:
                print("Usage: mute <call_id>")
                return
            
            self.send_to_backend({
                'type': 'set_mute',
                'call_id': args[0],
                'muted': True
            })
        
        elif command == 'unmute':
            if not args:
                print("Usage: unmute <call_id>")
                return
            
            self.send_to_backend({
                'type': 'set_mute',
                'call_id': args[0],
                'muted': False
            })
        
        elif command == 'hold':
            if not args:
                print("Usage: hold <call_id>")
                return
            
            self.send_to_backend({
                'type': 'set_hold',
                'call_id': args[0],
                'on_hold': True
            })
        
        elif command == 'unhold':
            if not args:
                print("Usage: unhold <call_id>")
                return
            
            self.send_to_backend({
                'type': 'set_hold',
                'call_id': args[0],
                'on_hold': False
            })
        
        elif command == 'conf' or command == 'conference':
            if len(args) < 2:
                print("Usage: conf <call_id1> <call_id2> [<call_id3> ...]")
                return
            
            self.send_to_backend({
                'type': 'setup_conference',
                'call_ids': args
            })
        
        elif command == 'audio':
            self.send_to_backend({'type': 'get_audio_devices'})
        
        elif command == 'history':
            filter_type = args[0] if args else None
            self.send_to_backend({
                'type': 'get_call_history',
                'filter_type': filter_type
            })
        
        elif command == 'contacts':
            self.send_to_backend({'type': 'get_contacts'})
        
        elif command == 'search':
            if not args:
                print("Usage: search <query>")
                return
            
            self.send_to_backend({
                'type': 'search_contacts',
                'query': args[0]
            })
        
        elif command == 'test-incoming':
            call_id = simulate_incoming_call(self.backend.pjsua_handler)
            print(f"Simulated incoming call with ID: {call_id}")
        
        else:
            print(f"Unknown command: {command}")
            self.print_help()
    
    def print_help(self):
        """Print help information"""
        print("\nAvailable commands:")
        print("  help (h)                   - Show this help")
        print("  quit (q), exit             - Exit the program")
        print("  register (reg)             - Register SIP account")
        print("  unregister (unreg)         - Unregister SIP account")
        print("  call [number]              - Make a call")
        print("  answer <call_id>           - Answer an incoming call")
        print("  hangup <call_id>           - Hang up a call")
        print("  mute <call_id>             - Mute a call")
        print("  unmute <call_id>           - Unmute a call")
        print("  hold <call_id>             - Hold a call")
        print("  unhold <call_id>           - Unhold a call")
        print("  conference <id1> <id2> ... - Create a conference call")
        print("  audio                      - Get audio devices")
        print("  history [filter]           - Get call history")
        print("  contacts                   - Get contacts")
        print("  search <query>             - Search contacts")
        print("  test-incoming              - Simulate an incoming call")

if __name__ == "__main__":
    cli = SoftphoneCLI()
    cli.start()