#!/usr/bin/env python3
import json
import os
import uuid

class ContactManager:
    """
    Manages user contacts.
    Handles storage, retrieval, searching, and modification of contacts.
    """
    def __init__(self, contacts_file="contacts.json"):
        self.contacts_file = contacts_file
        self.contacts = {}
        self.load_contacts()
    
    def load_contacts(self):
        """Load contacts from file or create empty if not exists"""
        try:
            if os.path.exists(self.contacts_file):
                with open(self.contacts_file, 'r') as f:
                    self.contacts = json.load(f)
            else:
                self.contacts = {}
        except Exception as e:
            print(f"Error loading contacts: {str(e)}")
            self.contacts = {}
    
    def save_contacts(self):
        """Save contacts to file"""
        try:
            with open(self.contacts_file, 'w') as f:
                json.dump(self.contacts, f, indent=2)
        except Exception as e:
            print(f"Error saving contacts: {str(e)}")
    
    def get_contacts(self):
        """Get all contacts"""
        return list(self.contacts.values())
    
    def get_contact(self, contact_id):
        """Get a specific contact by ID"""
        return self.contacts.get(contact_id)
    
    def save_contact(self, contact_data):
        """
        Save or update a contact
        
        contact_data should be a dict with:
        - id: Contact ID (optional, will be generated if not provided)
        - name: Contact name
        - number: Phone number or SIP URI
        - email: Email address (optional)
        """
        # Ensure required fields are present
        required_fields = ['name', 'number']
        for field in required_fields:
            if field not in contact_data:
                raise ValueError(f"Missing required field: {field}")
        
        # Get or generate contact ID
        contact_id = contact_data.get('id')
        is_new = False
        if not contact_id:
            # Generate new ID for a new contact
            contact_id = str(uuid.uuid4())
            is_new = True
        
        # Create contact entry
        contact = {
            'id': contact_id,
            'name': contact_data['name'],
            'number': contact_data['number']
        }
        
        # Add optional fields
        if 'email' in contact_data:
            contact['email'] = contact_data['email']
        
        # Save contact
        self.contacts[contact_id] = contact
        self.save_contacts()
        
        return contact, is_new
    
    def delete_contact(self, contact_id):
        """Delete a contact by ID"""
        if contact_id in self.contacts:
            del self.contacts[contact_id]
            self.save_contacts()
            return True
        return False
    
    def search_contacts(self, query):
        """
        Search contacts by name or number
        
        Returns contacts that match the query string in either name, number or email
        """
        if not query:
            return self.get_contacts()
        
        query = query.lower()
        results = []
        
        for contact in self.contacts.values():
            if (query in contact['name'].lower() or 
                query in contact['number'].lower() or 
                ('email' in contact and query in contact['email'].lower())):
                results.append(contact)
        
        return results
    
    def import_contacts(self, contacts_data):
        """
        Import contacts from external data
        
        contacts_data should be a list of contact dicts
        """
        imported_count = 0
        for contact_data in contacts_data:
            try:
                self.save_contact(contact_data)
                imported_count += 1
            except Exception as e:
                print(f"Error importing contact: {str(e)}")
        
        return imported_count
    
    def export_contacts(self):
        """Export contacts data"""
        return self.get_contacts()

def test_contacts():
    """Test function for contacts"""
    manager = ContactManager("test_contacts.json")
    
    # Add some test contacts
    test_contacts = [
        {
            'name': 'John Doe',
            'number': '1234567890',
            'email': 'john@example.com'
        },
        {
            'name': 'Jane Smith',
            'number': '0987654321',
            'email': 'jane@example.com'
        },
        {
            'name': 'Bob Johnson',
            'number': 'sip:bob@example.com'
        }
    ]
    
    for contact in test_contacts:
        c, is_new = manager.save_contact(contact)
        print(f"Added contact: {c['name']} (new: {is_new})")
    
    # Print all contacts
    print("\nAll contacts:")
    for contact in manager.get_contacts():
        print(f"{contact['name']}: {contact['number']}")
    
    # Search contacts
    query = "john"
    print(f"\nSearch for '{query}':")
    for contact in manager.search_contacts(query):
        print(f"{contact['name']}: {contact['number']}")
    
    # Update a contact
    contacts = manager.get_contacts()
    if contacts:
        contact_to_update = contacts[0]
        contact_to_update['name'] = contact_to_update['name'] + " (Updated)"
        manager.save_contact(contact_to_update)
        print(f"\nUpdated contact: {contact_to_update['name']}")
    
    # Delete a contact
    contacts = manager.get_contacts()
    if len(contacts) > 1:
        contact_to_delete = contacts[1]
        manager.delete_contact(contact_to_delete['id'])
        print(f"\nDeleted contact: {contact_to_delete['name']}")
    
    # Final contacts
    print("\nFinal contacts:")
    for contact in manager.get_contacts():
        print(f"{contact['name']}: {contact['number']}")

if __name__ == "__main__":
    test_contacts()