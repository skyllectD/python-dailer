import time
import uuid
import pjsua as pj
import json
import os
import sys
import re

def handle_command(command):
    try:
        if command['command'] == 'make_call':
            phone_number = command.get('number')
            if phone_number:
                backend.make_call(phone_number)
        elif command['command'] == 'hangup_call':
            call_id = command.get('call_id')
            backend.hangup_call(call_id)
        elif command['command'] == 'answer_call':
            call_id = command.get('call_id')
            backend.answer_call(call_id)
        elif command['command'] == 'set_mute':
            call_id = command.get('call_id')
            muted = command.get('muted', False)
            backend.set_mute(call_id, muted)
        elif command['command'] == 'set_hold':
            call_id = command.get('call_id')
            on_hold = command.get('on_hold', False)
            backend.set_hold(call_id, on_hold)
        elif command['command'] == 'switch_call':
            call_id = command.get('call_id')
            backend.switch_call(call_id)
        elif command['command'] == 'setup_conference':
            backend.setup_conference()
        elif command['command'] == 'merge_call_to_conference':
            call_id = command.get('call_id')
            backend.merge_call_to_conference(call_id)
        elif command['command'] == 'end_conference':
            group_id = command.get('group_id')
            backend.end_conference(group_id)
    except Exception as e:
        print(f"Error handling command: {e}", file=sys.stderr)

class CallCallback(pj.CallCallback):
    def __init__(self, backend, call, call_id=None):
        super().__init__(call)
        self.backend = backend
        self.call_id = call_id

    def on_state(self):
        call_info = self.call.info()
        remote_uri = call_info.remote_uri
        match = re.search(r'sip:([^@]+)@', remote_uri)
        phone_number = match.group(1)
        print(f"Call with {call_info.remote_uri} is {call_info.state_text}, code = {call_info.last_code}")
        self.backend.send_to_frontend({
            'type': 'call_state',
            'remote_uri': call_info.remote_uri,
            'state': call_info.state_text,
            'number': phone_number,
            'code': call_info.last_code,
            'id':  self.call_id,
        })

        if call_info.state_text.lower() == "disconnctd":
            if self.call_id in self.backend.calls:
                del self.backend.calls[self.call_id]
                print(f"Call {self.call_id} removed from active calls.")

    def on_media_state(self):
        if self.call.info().media_state == pj.MediaState.ACTIVE:
            call_slot = self.call.info().conf_slot
            self.backend.lib.conf_connect(call_slot, 0)
            self.backend.lib.conf_connect(0, call_slot)
            print("Media is now active")
        else:
            print("Media is inactive")

class AccountCallback(pj.AccountCallback):
    def __init__(self, account, backend):
        super().__init__(account)
        self.backend = backend

    def on_incoming_call(self, call):
        self.backend.current_call = call
        call_id = str(uuid.uuid4())
        self.backend.calls[call_id] = call  # Store the mapping

        call_cb = CallCallback(backend=self.backend, call=call, call_id=call_id)
        call.set_callback(call_cb)

        match = re.search(r'sip:([^@]+)@', call.info().remote_uri)
        phone_number = match.group(1)

        self.backend.send_to_frontend({
            'type': 'incoming_call',
            'remote_uri': call.info().remote_uri,
            'number': phone_number,
            'id': call_id
        })

class SoftphoneBackend:
    def __init__(self, config_path='softphone_config.json'):
        self.lib = None
        self.account = None
        self.current_call = None
        self.calls = {}
        # self.config_path = config_path
        # print("second 123", config_path)
        self.config = self.get_static_config()
        self.init_pjsua()
    # def load_config(self):
    #     if not os.path.exists(self.config_path):
    #         raise FileNotFoundError(f"Config file not found: {self.config_path}")
    #     with open('softphone_config.json', 'r') as f:
    #         config = json.load(f)
    #
    #     sip = config.get('sip', {})
    #     if not isinstance(sip.get('username'), str):
    #         sip['username'] = str(sip.get('username', ''))
    #     if not isinstance(sip.get('domain'), str):
    #         sip['domain'] = str(sip.get('domain', ''))
    #     config['sip'] = sip
    #
    #     return config

    def get_static_config(self):
        # Static configuration (previously loaded from softphone_config.json)
        return {
            "sip": {
                "username": "6009",
                "password": "WbZBA$I3%U!SC4%LkD$L",
                "domain": "phone.aptask.com",
                "proxy": "phone.aptask.com;transport=tcp"
            },
            "audio": {
                "input_device": None,
                "output_device": None  # Replace with the correct output device ID
            },
            "log_level": "info"
        }

    def send_to_frontend(self, message):
        try:
            json_message = json.dumps(message)
            print(json_message, flush=True)
        except Exception as e:
            print(f"Error sending message to frontend: {e}", file=sys.stderr)

    def init_pjsua(self):
        try:
            log_level = self.get_log_level()
            self.lib = pj.Lib()

            self.lib.init(log_cfg=pj.LogConfig(level=log_level, console_level=log_level))
            self.lib.create_transport(pj.TransportType.TCP, pj.TransportConfig())
            self.lib.start()
            self.set_audio_devices()

            sip = self.config['sip']

            if sip['username'] and sip['password'] and sip['domain']:
                acc_cfg = pj.AccountConfig(
                    domain=sip['domain'],
                    username=sip['username'],
                    password=sip['password']
                )
                acc_cfg.id = f"sip:{sip['username']}@{sip['domain']}"
                if sip['proxy']:
                    acc_cfg.proxy = [f"sip:{sip['proxy']}"]

                self.account = self.lib.create_account(acc_cfg)
                acc_cb = AccountCallback(account=self.account, backend=self)
                self.account.set_callback(acc_cb)

                print("SIP account registered", self.account)
                self.send_to_frontend({'type': 'registered', 'message': 'SIP registered successfully'})

        except pj.Error as e:
            self.send_to_frontend({'type': 'error', 'message': f"PJSUA init error: {str(e)}"})
            self.shutdown()

    def set_audio_devices(self):
        audio_cfg = self.config.get('audio', {})
        input_dev = audio_cfg.get('input_device')
        output_dev = audio_cfg.get('output_device')

        if input_dev is not None and output_dev is not None:
            try:
                self.lib.set_snd_dev(input_dev, output_dev)
                print(f"Audio devices set: Input={input_dev}, Output={output_dev}")
            except pj.Error as e:
                print(f"Error setting audio devices: {e}", file=sys.stderr)

    def get_log_level(self):
        level = self.config.get("advanced", {}).get("log_level", "info").lower()
        return {
            "none": 0,
            "error": 1,
            "warn": 2,
            "info": 3,
            "debug": 4,
            "trace": 5
        }.get(level, 3)

    def make_call(self, uri):
        if self.account:
            try:
                for call_id, call in self.calls.items():
                    call_info = call.info()
                    if call_info.media_state == pj.MediaState.ACTIVE:
                        call.hold()
                        print(f"Call {call_id} put on hold.")

                print(f"Making call to {uri}")
                sip = self.config['sip']
                dst_uri = f"sip:{uri}@{sip['domain']}"
                call_id = str(uuid.uuid4())
                self.calls[call_id] = self.account.make_call(dst_uri)
                call_callback = CallCallback(backend=self, call=self.calls[call_id], call_id=call_id)
                self.calls[call_id].set_callback(call_callback)

                self.send_to_frontend({'type': 'call_init', 'id': call_id})

            except pj.Error as e:
                print(f"Error making call: {e}", file=sys.stderr)
                self.send_to_frontend({'type': 'error', 'message': f"Make call failed: {str(e)}"})
            except Exception as e:
                print(f"Unexpected error in make_call: {e}", file=sys.stderr)
                self.send_to_frontend({'type': 'error', 'message': f"Unexpected error: {str(e)}"})

    def answer_call(self, current_call_id):
        if self.calls[current_call_id]:
            try:
                self.calls[current_call_id].answer(200)

                for call_ids in self.calls:
                    # Skip holding the current answered call
                    if call_ids != current_call_id:
                        if self.calls[call_ids].info().media_state == pj.MediaState.ACTIVE:
                            self.calls[call_ids].hold()

            except pj.Error as e:
                self.send_to_frontend({'type': 'error', 'message': f"Answer call failed: {str(e)}"})

    def hangup_call(self, call_id):
        try:
            call_ids = list(self.calls.keys()) if call_id == 'all' else [call_id]  # Create a copy of keys
            for call_id in call_ids:
                if self.calls.get(call_id):  # Use .get() to avoid KeyError
                    if self.calls[call_id].info().state not in [pj.CallState.DISCONNECTED, pj.CallState.NULL]:
                        self.calls[call_id].hangup()
                    del self.calls[call_id]  # Safely delete after processing
                else:
                    print(f"Call {call_id} is already terminated or not active.")

            if len(self.calls) > 0:
                first_call = list(self.calls.values())[0]
                try:
                    call_info = first_call.info()
                    if call_info.media_state in [pj.MediaState.LOCAL_HOLD, pj.MediaState.ACTIVE]:
                        first_call.reinvite()
                except Exception as e:
                    print(f"Error retrieving info or unholding call: {e}")

        except pj.Error as e:
                self.send_to_frontend({'type': 'error', 'message': f"Hangup call failed: {str(e)}"})

    def setup_conference(self):
        try:
            active_slots = []

            # Activate all calls and collect slots
            for call_id in self.calls:
                info = self.calls[call_id].info()
                if info.media_state != pj.MediaState.ACTIVE:
                    self.calls[call_id].reinvite()
                    time.sleep(2)
                    info = self.calls[call_id].info()

                if info.media_state == pj.MediaState.ACTIVE and info.conf_slot != -1:
                    active_slots.append(info.conf_slot)
                else:
                    print(f"⚠️ Call {call_id} still inactive.")

            if len(active_slots) < 2:
                self.send_to_frontend({'type': 'error', 'message': 'Need at least 2 active calls for conference'})
                return

            group_name = f"Conference-{uuid.uuid4().hex[:6]}"
            # Connect all slots to each other
            for i in range(len(active_slots)):
                for j in range(i + 1, len(active_slots)):
                    self.lib.conf_connect(active_slots[i], active_slots[j])
                    self.lib.conf_connect(active_slots[j], active_slots[i])

            call_list = []

            for call_id in self.calls:
                call_info = self.calls[call_id].info()
                if call_info.media_state == pj.MediaState.ACTIVE:
                    remote_uri = call_info.remote_uri
                    match = re.search(r'sip:([^@]+)@', remote_uri)
                    phone_number = match.group(1) if match else None

                    call_list.append({
                        'number': phone_number,
                        'state': str(call_info.state),
                        'id': call_id,
                    })

            self.send_to_frontend({
                'type': 'conference_state',
                'message': 'Conference call set up successfully',
                'group_name': group_name,
                'calls': call_list
            })
            print("✅ Conference bridge created.")

        except Exception as e:
            print(f"❌ Error setting up conference: {e}")
            self.send_to_frontend({'type': 'error', 'message': str(e)})

    def set_mute(self, call_id, muted):
        """Mute or unmute a call."""
        try:
            call = self.get_call_by_id(call_id)
            if call:
                call_info = call.info()
                print(f"Call ID: {call_id}, Media State: {call_info.media_state}, Conf Slot: {call_info.conf_slot}")

                if call_info.media_state == pj.MediaState.ACTIVE:
                    call_slot = call_info.conf_slot
                    if muted:
                        self.lib.conf_disconnect(call_slot, 0)
                        self.lib.conf_disconnect(0, call_slot)
                        self.send_to_frontend({'type': 'call_mute_state', 'message': 'Call muted', 'muted': True})
                    else:
                        self.lib.conf_connect(call_slot, 0)
                        self.lib.conf_connect(0, call_slot)
                        self.send_to_frontend({'type': 'call_mute_state', 'message': 'Call unmuted', 'muted': False})
                else:
                    self.send_to_frontend({'type': 'error', 'message': 'Call media is not active'})
            else:
                self.send_to_frontend({'type': 'error', 'message': 'Invalid call ID'})
        except Exception as e:
            print(f"Error in set_mute: {e}", file=sys.stderr)
            self.send_to_frontend({'type': 'error', 'message': f"Failed to set mute state: {str(e)}"})

    def set_hold(self, call_id, on_hold):
        """Put a call on hold or resume it."""
        try:
            call = self.get_call_by_id(call_id)
            if call:
                call_info = call.info()
                if on_hold and call_info.media_state == pj.MediaState.ACTIVE:
                    # Put the call on hold
                    call.hold()
                    self.send_to_frontend({'type': 'call_hold_state', 'message': 'Call on hold', 'on_hold': True})
                elif not on_hold and call_info.media_state in [pj.MediaState.LOCAL_HOLD, pj.MediaState.ACTIVE]:
                    # Resume the call
                    call.reinvite()
                    self.send_to_frontend({'type': 'call_hold_state', 'message': 'Call resumed', 'on_hold': False})
                else:
                    self.send_to_frontend({'type': 'error', 'message': 'Call not in a valid state for hold/unhold'})
            else:
                self.send_to_frontend({'type': 'error', 'message': 'Invalid call ID'})
        except Exception as e:
            self.send_to_frontend({'type': 'error', 'message': f"Failed to set hold state: {str(e)}"})

    def switch_call(self, current_call_id):
        """Switch between active calls."""
        try:
            if current_call_id not in self.calls:
                self.send_to_frontend({'type': 'error', 'message': 'Invalid call ID'})
                return

            for call_id, call in self.calls.items():
                if call.info().state not in [pj.CallState.DISCONNECTED, pj.CallState.NULL]:
                    if call_id == current_call_id:
                        # Resume the selected call
                        if call.info().media_state in [pj.MediaState.LOCAL_HOLD, pj.MediaState.ACTIVE]:
                            call.reinvite()
                            self.send_to_frontend({'type': 'call_switch', 'message': f'Switched to call {call_id}', 'active_call': call_id})
                    else:
                        # Put other calls on hold
                        if call.info().media_state == pj.MediaState.ACTIVE:
                            call.hold()
        except Exception as e:
            self.send_to_frontend({'type': 'error', 'message': f"Failed to switch call: {str(e)}"})

    # Add a method to merge a new call into an existing conference
    def merge_call_to_conference(self, call_id):
        try:
            if call_id not in self.calls:
                self.send_to_frontend({'type': 'error', 'message': 'Invalid call ID'})
                return

            call_info = self.calls[call_id].info()
            if call_info.media_state != pj.MediaState.ACTIVE:
                self.calls[call_id].reinvite()
                time.sleep(2)  # Wait for the call to become active
                call_info = self.calls[call_id].info()

            if call_info.media_state == pj.MediaState.ACTIVE and call_info.conf_slot != -1:
                # Connect the new call to all existing conference slots
                for existing_call_id in self.calls:
                    existing_call_info = self.calls[existing_call_id].info()
                    if existing_call_info.media_state == pj.MediaState.ACTIVE and existing_call_info.conf_slot != -1:
                        self.lib.conf_connect(call_info.conf_slot, existing_call_info.conf_slot)
                        self.lib.conf_connect(existing_call_info.conf_slot, call_info.conf_slot)
                        print(f"🔗 Merged call {call_id} into conference with call {existing_call_id}")

                self.send_to_frontend({
                    'type': 'conference_state',
                    'message': 'Call merged into conference successfully',
                    'calls': [
                        {
                            'number': self.calls[call_id].info().remote_uri,
                            'state': str(self.calls[call_id].info().state)
                        }
                        for call_id in self.calls
                        if self.calls[call_id].info().media_state == pj.MediaState.ACTIVE
                    ]
                })
            else:
                self.send_to_frontend({'type': 'error', 'message': 'Call media is not active or invalid'})
        except Exception as e:
            print(f"❌ Error merging call into conference: {e}")
            self.send_to_frontend({'type': 'error', 'message': str(e)})

    def end_conference(self, group_id):
        try:
            # Iterate through all active calls and hang them up
            for call_id, call in self.calls.items():
                if call.info().media_state == pj.MediaState.ACTIVE:
                    call.hangup()

            # Notify the frontend that the conference has ended
            self.send_to_frontend({
                'type': 'conference_ended',
                'group_id': group_id,
                'message': 'Conference ended successfully'
            })
            print(f"✅ Conference with group ID {group_id} ended.")
        except Exception as e:
            print(f"❌ Error ending conference: {e}")
            self.send_to_frontend({
                'type': 'error',
                'message': f"Failed to end conference: {str(e)}"
            })

    def get_call_by_id(self, call_id):
        """Retrieve a call object by its ID."""
        return self.calls.get(call_id)

    def shutdown(self):
        try:
            if self.calls:
                for call_id in self.calls:  # Use list() to avoid runtime modification issues
                    if self.calls[call_id].info().state not in [pj.CallState.DISCONNECTED, pj.CallState.NULL]:
                        self.calls[call_id].hangup()

            if self.account:
                self.account.delete()
            if self.lib:
                self.lib.destroy()
                self.lib = None
            print("PJSUA shutdown completed")
        except pj.Error as e:
            print(f"Error during shutdown: {e}", file=sys.stderr)

if __name__ == "__main__":
    backend = SoftphoneBackend()

    try:
        while True:
            line = sys.stdin.readline()
            if not line:
                break
            command = json.loads(line.strip())
            handle_command(command)

    except (KeyboardInterrupt, EOFError):
        backend.shutdown()
        print("Softphone backend stopped.")
