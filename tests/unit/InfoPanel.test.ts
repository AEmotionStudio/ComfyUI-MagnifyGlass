import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import InfoPanel from '../../src/info-panel/components/InfoPanel.vue';

describe('InfoPanel.vue', () => {
    it('is initially hidden if initialVisible is false', () => {
        const wrapper = mount(InfoPanel, {
            props: { initialVisible: false }
        });
        expect(wrapper.find('.mag-info-panel').exists()).toBe(false);
    });

    it('renders node info when hoveredNode is present', async () => {
        const wrapper = mount(InfoPanel, {
            props: { initialVisible: true }
        });

        // Simulate state update (since component uses internal ref, we need to access exposed method or setup state)
        // In our component definition, we returned `updateState`.
        // However, simpler for this test is to modify the internal state if we can, or refactor component to take props.
        // Given the component uses `visible` ref initialized from prop, checking it exists is tricky if it's strictly v-if.

        // Let's rely on the fact that we can interact with the component instance
        const vm = wrapper.vm as any;
        vm.visible = true;
        vm.hoveredNode = { id: 123, title: 'Test Node', type: 'TestType' };

        await wrapper.vm.$nextTick();

        expect(wrapper.text()).toContain('Test Node');
        expect(wrapper.text()).toContain('ID:');
        expect(wrapper.text()).toContain('123');
    });

    it('toggles pin state', async () => {
        const wrapper = mount(InfoPanel, {
            props: { initialVisible: true }
        });
        const vm = wrapper.vm as any;
        vm.visible = true;
        await wrapper.vm.$nextTick();

        const pinBtn = wrapper.find('button');
        expect(vm.pinned).toBe(false);

        await pinBtn.trigger('click');
        expect(vm.pinned).toBe(true);
    });
});
