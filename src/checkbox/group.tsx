import { defineComponent, provide, computed, VNode, h, reactive, watchEffect, ref, toRefs, PropType } from 'vue';
import intersection from 'lodash/intersection';
import Checkbox from './checkbox';
import checkboxGroupProps from './checkbox-group-props';
import { usePrefixClass } from '../config-provider';
import props from './checkbox-group-props';
import {
  CheckboxOptionObj,
  TdCheckboxProps,
  CheckboxGroupValue,
  CheckboxGroupChangeContext,
  CheckboxGroupInjectionKey,
} from './type';

// hooks
import useVModel from '../hooks/useVModel';
import { useConfig } from '../config-provider/useConfig';

export default defineComponent({
  name: 'TCheckboxGroup',
  components: {
    Checkbox,
  },
  props,

  setup(props, { emit, slots }) {
    /** 样式 */
    const { classPrefix } = useConfig('classPrefix');
    const name = `${classPrefix.value}-checkbox-group`;

    const { isArray } = Array;
    const { value, modelValue } = toRefs(props);
    const [innerValue, setInnerValue] = useVModel(value, modelValue, props.defaultValue, props.onChange, emit, 'value');

    // data
    const checkedMap = ref<{ [key: string | number]: boolean }>({});
    const optionList = ref<Array<CheckboxOptionObj>>([]);

    // computed

    const intersectionLen = computed<number>(() => {
      const values = optionList.value.map((item) => item.value);
      if (isArray(innerValue.value)) {
        const n = intersection(innerValue.value, values);
        return n.length;
      }
      return 0;
    });

    const isCheckAll = computed<boolean>(() => {
      if (isArray(innerValue.value) && innerValue.value.length !== optionList.value.length - 1) {
        return false;
      }
      return intersectionLen.value === optionList.value.length - 1;
    });

    const indeterminate = computed<boolean>(
      () => !isCheckAll.value && intersectionLen.value < optionList.value.length && intersectionLen.value !== 0,
    );

    const maxExceeded = computed<boolean>(() => props.max !== undefined && innerValue.value.length === props.max);

    // watch
    watchEffect(() => {
      if (isArray(innerValue.value)) {
        const map = {};
        innerValue.value.forEach((item: string | number) => {
          map[item] = true;
        });
        checkedMap.value = map;
      }
    });

    watchEffect(() => {
      if (!props.options) return [];
      optionList.value = props.options.map((item) => {
        let r: CheckboxOptionObj = {};
        if (typeof item !== 'object') {
          r = { label: String(item), value: item };
        } else {
          r = { ...item };
          r.disabled = r.disabled === undefined ? props.disabled : r.disabled;
        }
        return r;
      });
    });

    // methods
    const emitChange = (val: CheckboxGroupValue, context: CheckboxGroupChangeContext) => setInnerValue(val, context);

    const getAllCheckboxValue = (): CheckboxGroupValue => {
      const val = new Set<TdCheckboxProps['value']>();
      for (let i = 0, len = optionList.value.length; i < len; i++) {
        const item = optionList.value[i];
        if (item.checkAll) continue;
        val.add(item.value);
        if (maxExceeded.value) break;
      }
      return [...val];
    };

    const onCheckAllChange = (checked: boolean, context: { e: Event; source?: 't-checkbox' }) => {
      const value: CheckboxGroupValue = checked ? getAllCheckboxValue() : [];
      emitChange(value, {
        e: context.e,
        type: checked ? 'check' : 'uncheck',
        current: undefined,
      });
    };

    const handleCheckboxChange = (data: { checked: boolean; e: Event; option: TdCheckboxProps }) => {
      const currentValue = data.option.value;
      if (isArray(innerValue.value)) {
        const val = [...innerValue.value];
        if (data.checked) {
          val.push(currentValue);
        } else {
          const i = val.indexOf(currentValue);
          val.splice(i, 1);
        }
        emitChange(val, {
          e: data.e,
          current: data.option.value,
          type: data.checked ? 'check' : 'uncheck',
        });
      } else {
        console.warn(`TDesign CheckboxGroup Warn: \`value\` must be an array, instead of ${typeof innerValue.value}`);
      }
    };

    const onCheckedChange = (p: { checked: boolean; checkAll: boolean; e: Event; option: TdCheckboxProps }) => {
      const { checked, checkAll, e } = p;
      if (checkAll) {
        onCheckAllChange(checked, { e });
      } else {
        handleCheckboxChange(p);
      }
    };

    const getOptionListBySlots = (nodes: VNode[]) => {
      const arr: Array<CheckboxOptionObj> = [];
      nodes?.forEach((node) => {
        const option = node.props as CheckboxOptionObj;
        if (option?.['check-all'] === '' || option?.['check-all'] === true) {
          option.checkAll = true;
        }
        option && arr.push(option);
      });
      return arr;
    };

    const renderLabel = (option: CheckboxOptionObj) => {
      if (typeof option.label === 'function') {
        return option.label(h);
      }
      return option.label;
    };

    // provide
    provide(
      CheckboxGroupInjectionKey,
      reactive({
        name: props.name,
        isCheckAll,
        checkedMap,
        maxExceeded,
        disabled: props.disabled,
        indeterminate,
        handleCheckboxChange,
        onCheckedChange,
      }),
    );

    return () => {
      let children = null;
      if (props.options?.length) {
        children = optionList.value?.map((option, index) => (
          <Checkbox key={`${option.value}${index}`} {...option} checked={checkedMap.value[option.value]}>
            {renderLabel(option)}
          </Checkbox>
        ));
      } else {
        const nodes = slots.default && slots.default(null);
        optionList.value = getOptionListBySlots(nodes);
        children = nodes;
      }
      return <div class={name}>{children}</div>;
    };
  },
});
