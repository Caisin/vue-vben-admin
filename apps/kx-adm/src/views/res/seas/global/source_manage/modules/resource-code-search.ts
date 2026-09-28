import { computed, ref } from 'vue';

import { message } from 'antdv-next';

import { ResourceCodeApi } from '#/api/res/seas/global/resource_codes';
import { requestErrorMessage } from '#/request-errors';

/** 作品编号和名称远程搜索，迟到的响应不能覆盖最新结果。 */
export function useResourceCodeSearch(selected?: () => string | undefined) {
  const items = ref<Array<{ label: string; value: string }>>([]);
  const loading = ref(false);
  let revision = 0;
  const options = computed(() => {
    const value = selected?.();
    return value && !items.value.some((item) => item.value === value)
      ? [{ label: value, value }, ...items.value]
      : items.value;
  });
  async function search(keyword = '') {
    const request = ++revision;
    loading.value = true;
    try {
      const result = await ResourceCodeApi.list({
        keyword: keyword.trim() || undefined,
        page: 1,
        size: 50,
      });
      if (request === revision)
        items.value = result.items.map((item) => ({
          label: `${item.code} · ${item.name}`,
          value: item.code,
        }));
    } catch (error) {
      if (request === revision)
        message.error(requestErrorMessage(error, '搜索作品编号失败'));
    } finally {
      if (request === revision) loading.value = false;
    }
  }
  const componentProps = () => ({
    allowClear: true,
    showSearch: true,
    filterOption: false,
    loading: loading.value,
    options: options.value,
    placeholder: '搜索编号、作品名称或作者',
    onFocus: () => search(),
    onSearch: search,
  });
  function addOption(code: { code: string; name: string }) {
    ++revision;
    loading.value = false;
    items.value = [
      { label: `${code.code} · ${code.name}`, value: code.code },
      ...items.value.filter((item) => item.value !== code.code),
    ];
  }
  return { addOption, componentProps, search };
}
