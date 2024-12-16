import { fixture, html, expect } from '@open-wc/testing';
import '../aurora-group-manager.js';

describe('AuroraGroupManager', () => {
    let element;
    let mockHass;

    const mockLightEntities = {
        'light.living_room_1': {
            entity_id: 'light.living_room_1',
            state: 'on',
            attributes: {
                friendly_name: 'Living Room Light 1',
                supported_features: 63
            }
        },
        'light.living_room_2': {
            entity_id: 'light.living_room_2',
            state: 'on',
            attributes: {
                friendly_name: 'Living Room Light 2',
                supported_features: 63
            }
        }
    };

    const mockGroups = {
        'group_1': {
            id: 'group_1',
            name: 'Living Room',
            entities: ['light.living_room_1', 'light.living_room_2'],
            zone: 'main',
            position: { x: 0, y: 0, z: 0 }
        }
    };

    beforeEach(async () => {
        mockHass = {
            callService: jest.fn(),
            callWS: jest.fn().mockImplementation(params => {
                if (params.type === 'aurora_sound_to_light/get_groups') {
                    return { groups: mockGroups };
                }
                if (params.type === 'aurora_sound_to_light/get_light_entities') {
                    return { entities: mockLightEntities };
                }
                return null;
            }),
            states: mockLightEntities
        };

        element = await fixture(html`<aurora-group-manager></aurora-group-manager>`);
        element.hass = mockHass;
        await element.updateComplete;
    });

    describe('Initialization', () => {
        test('should load available light entities', async () => {
            expect(element.availableEntities).toEqual(
                Object.values(mockLightEntities).map(e => e.entity_id)
            );
        });

        test('should load existing groups', async () => {
            expect(element.groups).toEqual(mockGroups);
        });

        test('should initialize 3D positioning interface', () => {
            const canvas3D = element.shadowRoot.querySelector('.position-canvas');
            expect(canvas3D).toBeTruthy();
        });
    });

    describe('Group Creation', () => {
        test('should create new group', async () => {
            const createButton = element.shadowRoot.querySelector('.create-group-button');
            await createButton.click();

            const nameInput = element.shadowRoot.querySelector('.group-name-input');
            nameInput.value = 'New Group';
            nameInput.dispatchEvent(new Event('change'));

            const entitySelect = element.shadowRoot.querySelector('.entity-select');
            entitySelect.value = ['light.living_room_1'];
            entitySelect.dispatchEvent(new Event('change'));

            const saveButton = element.shadowRoot.querySelector('.save-group-button');
            await saveButton.click();

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'create_group',
                {
                    name: 'New Group',
                    entities: ['light.living_room_1']
                }
            );
        });

        test('should validate group creation', async () => {
            await element._createGroup({
                name: '',
                entities: []
            });

            const errorMessage = element.shadowRoot.querySelector('.error-message');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage.textContent).toContain('Group name is required');
        });
    });

    describe('Group Management', () => {
        test('should update group', async () => {
            element.selectedGroup = 'group_1';
            await element.updateComplete;

            const nameInput = element.shadowRoot.querySelector('.group-name-input');
            nameInput.value = 'Updated Group';
            nameInput.dispatchEvent(new Event('change'));

            const updateButton = element.shadowRoot.querySelector('.update-group-button');
            await updateButton.click();

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'update_group',
                {
                    group_id: 'group_1',
                    name: 'Updated Group',
                    entities: ['light.living_room_1', 'light.living_room_2']
                }
            );
        });

        test('should delete group', async () => {
            element.selectedGroup = 'group_1';
            await element.updateComplete;

            const deleteButton = element.shadowRoot.querySelector('.delete-group-button');
            await deleteButton.click();

            const confirmButton = element.shadowRoot.querySelector('.confirm-delete-button');
            await confirmButton.click();

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'delete_group',
                {
                    group_id: 'group_1'
                }
            );
        });
    });

    describe('Zone Mapping', () => {
        test('should assign zone to group', async () => {
            element.selectedGroup = 'group_1';
            await element.updateComplete;

            const zoneSelect = element.shadowRoot.querySelector('.zone-select');
            zoneSelect.value = 'dance_floor';
            zoneSelect.dispatchEvent(new Event('change'));

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'assign_zone',
                {
                    group_id: 'group_1',
                    zone: 'dance_floor'
                }
            );
        });

        test('should update zone mapping', async () => {
            const zoneMap = {
                main: ['group_1'],
                dance_floor: []
            };

            await element._updateZoneMapping(zoneMap);
            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'update_zone_mapping',
                { zones: zoneMap }
            );
        });
    });

    describe('3D Positioning', () => {
        test('should update group position', async () => {
            element.selectedGroup = 'group_1';
            await element.updateComplete;

            const position = { x: 1, y: 2, z: 3 };
            await element._updateGroupPosition('group_1', position);

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'update_group_position',
                {
                    group_id: 'group_1',
                    position
                }
            );
        });

        test('should handle 3D canvas interactions', async () => {
            const canvas = element.shadowRoot.querySelector('.position-canvas');

            // Simulate drag event
            const dragEvent = new MouseEvent('mousedown', {
                clientX: 100,
                clientY: 100
            });
            canvas.dispatchEvent(dragEvent);

            // Simulate move
            const moveEvent = new MouseEvent('mousemove', {
                clientX: 150,
                clientY: 150
            });
            document.dispatchEvent(moveEvent);

            // Simulate release
            const upEvent = new MouseEvent('mouseup');
            document.dispatchEvent(upEvent);

            expect(element._updateGroupPosition).toHaveBeenCalled();
        });
    });

    describe('Drag and Drop', () => {
        test('should handle entity drag and drop', async () => {
            const dragSource = element.shadowRoot.querySelector('.entity-item');
            const dropTarget = element.shadowRoot.querySelector('.group-container');

            // Simulate drag start
            const dragStartEvent = new DragEvent('dragstart', {
                dataTransfer: new DataTransfer()
            });
            await dragSource.dispatchEvent(dragStartEvent);

            // Simulate drop
            const dropEvent = new DragEvent('drop', {
                dataTransfer: dragStartEvent.dataTransfer
            });
            await dropTarget.dispatchEvent(dropEvent);

            expect(element._handleEntityDrop).toHaveBeenCalled();
        });

        test('should update group after drop', async () => {
            await element._handleEntityDrop({
                groupId: 'group_1',
                entityId: 'light.kitchen_1'
            });

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'update_group',
                expect.any(Object)
            );
        });
    });

    describe('Group Testing', () => {
        test('should test group', async () => {
            element.selectedGroup = 'group_1';
            await element.updateComplete;

            const testButton = element.shadowRoot.querySelector('.test-group-button');
            await testButton.click();

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'test_group',
                {
                    group_id: 'group_1'
                }
            );
        });

        test('should handle test results', async () => {
            const testResults = {
                success: true,
                response_time: 50,
                reachable_entities: ['light.living_room_1', 'light.living_room_2']
            };

            mockHass.callWS.mockResolvedValueOnce({ results: testResults });

            const results = await element._testGroup('group_1');
            expect(results).toEqual(testResults);
        });
    });

    describe('Preset Management', () => {
        test('should save group preset', async () => {
            element.selectedGroup = 'group_1';
            await element.updateComplete;

            const savePresetButton = element.shadowRoot.querySelector('.save-preset-button');
            await savePresetButton.click();

            const presetNameInput = element.shadowRoot.querySelector('.preset-name-input');
            presetNameInput.value = 'My Preset';
            presetNameInput.dispatchEvent(new Event('change'));

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'save_group_preset',
                {
                    name: 'My Preset',
                    group_id: 'group_1'
                }
            );
        });

        test('should load group preset', async () => {
            const mockPreset = {
                name: 'My Preset',
                configuration: mockGroups.group_1
            };

            mockHass.callWS.mockResolvedValueOnce({ preset: mockPreset });

            await element._loadPreset('preset_1');
            expect(element.groups['group_1']).toEqual(mockPreset.configuration);
        });
    });

    describe('Error Handling', () => {
        test('should handle group creation errors', async () => {
            mockHass.callService.mockRejectedValue(new Error('Failed to create group'));

            const createButton = element.shadowRoot.querySelector('.create-group-button');
            await createButton.click();

            const errorMessage = element.shadowRoot.querySelector('.error-message');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage.textContent).toContain('Failed to create group');
        });

        test('should handle position update errors', async () => {
            mockHass.callService.mockRejectedValue(new Error('Failed to update position'));

            await element._updateGroupPosition('group_1', { x: 0, y: 0, z: 0 });

            const errorMessage = element.shadowRoot.querySelector('.error-message');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage.textContent).toContain('Failed to update position');
        });
    });

    describe('Accessibility', () => {
        test('should have proper ARIA labels', () => {
            const controls = element.shadowRoot.querySelector('.group-controls');
            expect(controls.querySelector('.create-group-button')).toHaveAttribute('aria-label');
            expect(controls.querySelector('.group-name-input')).toHaveAttribute('aria-label');
        });

        test('should handle keyboard navigation', async () => {
            const groupItem = element.shadowRoot.querySelector('.group-item');
            await groupItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

            expect(element.selectedGroup).toBe('group_1');
        });
    });

    describe('Performance', () => {
        test('should throttle position updates', async () => {
            element.selectedGroup = 'group_1';
            await element.updateComplete;

            // Rapidly update position multiple times
            for (let i = 0; i < 5; i++) {
                await element._updateGroupPosition('group_1', { x: i, y: i, z: i });
            }

            // Should only call service once due to throttling
            expect(mockHass.callService).toHaveBeenCalledTimes(1);
        });

        test('should optimize 3D rendering', () => {
            const canvas = element.shadowRoot.querySelector('.position-canvas');
            const context = canvas.getContext('webgl');

            expect(context.getContextAttributes().antialias).toBe(false);
            expect(context.getContextAttributes().depth).toBe(true);
        });
    });
}); 