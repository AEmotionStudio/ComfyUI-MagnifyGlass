import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ComfyPanel from '../../src/components/ComfyPanel.vue';

describe('ComfyPanel.vue', () => {
    it('renders title correctly', () => {
        const title = 'Test Panel';
        const wrapper = mount(ComfyPanel, {
            props: { title }
        });
        expect(wrapper.find('h1').text()).toBe(title);
    });

    it('renders slot content', () => {
        const wrapper = mount(ComfyPanel, {
            slots: {
                default: '<div class="test-content">Content</div>'
            }
        });
        expect(wrapper.find('.test-content').exists()).toBe(true);
    });

    it('applies theme class', () => {
        const wrapper = mount(ComfyPanel, {
            props: { theme: 'light' }
        });
        expect(wrapper.classes()).toContain('theme-light');
    });
});
