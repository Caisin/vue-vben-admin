import type { Ref } from 'vue';

import type {
  DingtalkKnowledgeTargetCfg,
  DingtalkKnowledgeTargetWrite,
  DingtalkNodeView,
  DingtalkOperatorOption,
  DingtalkOperatorTreeNode,
  DingtalkWorkspaceView,
} from '#/api';

import { computed, ref } from 'vue';

import { useUserStore } from '@vben/stores';

import { message } from 'antdv-next';

import { OrgSyncApi } from '#/api/auth';
import { DingtalkNotifyApi } from '#/api/param/dingtalk-notify';

import { dingtalkKnowledgeError } from './dingtalk-knowledge-error';

interface KnowledgeTreeNode {
  children?: KnowledgeTreeNode[];
  isLeaf: boolean;
  key: string;
  node_id: string;
  path: string;
  title: string;
  value: string;
  workspace_id: string;
}

interface KnowledgeTargetOptions {
  editingId: Ref<number | string | undefined>;
  form: DingtalkKnowledgeTargetWrite;
}

interface OperatorTreeOption {
  children?: OperatorTreeOption[];
  selectable?: boolean;
  title: string;
  value: string;
}

export function useKnowledgeTargetOptions({
  editingId,
  form,
}: KnowledgeTargetOptions) {
  const userStore = useUserStore();
  const treeNodes = ref<KnowledgeTreeNode[]>([]);
  const treeValue = ref<string>();
  const treeLoading = ref(false);
  const treeError = ref('');
  const treeErrorDetail = ref('');
  const treeErrorLink = ref('');
  const operatorTree = ref<DingtalkOperatorTreeNode[]>([]);
  const operatorLoading = ref(false);
  let operatorRequest = 0;
  let treeRequest = 0;

  const operatorOptions = computed(() => {
    const options = operatorTree.value.map(toOperatorTreeOption);
    const current = form.operator_union_id;
    if (current && !operatorTreeContains(options, current)) {
      options.unshift({ title: `当前配置 (${current})`, value: current });
    }
    return options;
  });

  function prepare(row?: DingtalkKnowledgeTargetCfg) {
    treeNodes.value = row ? [treeRootFromTarget(row)] : [];
    treeValue.value = row
      ? treeNodeValue(row.workspace_id, row.parent_node_id)
      : undefined;
    void loadOperators();
    if (row) {
      void loadTreeRoots();
    }
  }

  async function loadOperators() {
    const appKey = form.app_key.trim();
    if (!appKey) {
      operatorTree.value = [];
      return;
    }
    const request = ++operatorRequest;
    const currentUid = userStore.userInfo?.userId;
    const shouldDefaultCurrentUser = Boolean(
      currentUid && !editingId.value && !form.operator_union_id,
    );
    operatorLoading.value = true;
    try {
      const [tree, currentPage] = await Promise.all([
        OrgSyncApi.dingtalk_operator_tree(appKey),
        shouldDefaultCurrentUser
          ? OrgSyncApi.dingtalk_operators(appKey, {
              page: 1,
              size: 1,
              uid: currentUid,
            })
          : Promise.resolve(undefined),
      ]);
      if (request !== operatorRequest || appKey !== form.app_key) return;

      operatorTree.value = tree;
      const currentDisplayName =
        userStore.userInfo?.realName || userStore.userInfo?.username || '';
      const currentOperator =
        currentPage?.items[0] ??
        findUniqueOperatorByName(tree, currentDisplayName);
      if (currentOperator && !editingId.value && !form.operator_union_id) {
        form.operator_union_id = currentOperator.union_id;
        void loadTreeRoots();
      }
    } catch {
      if (request === operatorRequest) {
        operatorTree.value = [];
      }
    } finally {
      if (request === operatorRequest) {
        operatorLoading.value = false;
      }
    }
  }

  function resetLocation() {
    treeRequest += 1;
    treeLoading.value = false;
    form.workspace_id = '';
    form.parent_node_id = '';
    form.parent_node_path = '';
    treeNodes.value = [];
    treeValue.value = undefined;
    treeError.value = '';
    treeErrorDetail.value = '';
    treeErrorLink.value = '';
  }

  function onAppChange(value: string) {
    form.app_key = value;
    form.operator_union_id = '';
    operatorTree.value = [];
    resetLocation();
    void loadOperators();
  }

  function onOperatorChange(value: unknown) {
    form.operator_union_id = typeof value === 'string' ? value : '';
    resetLocation();
    if (form.operator_union_id) {
      void loadTreeRoots();
    }
  }

  async function loadTreeRoots() {
    if (!form.app_key || !form.operator_union_id.trim()) {
      message.warning('请先选择应用和操作人');
      return;
    }
    const request = ++treeRequest;
    const appKey = form.app_key;
    const operatorUnionId = form.operator_union_id.trim();
    treeLoading.value = true;
    treeError.value = '';
    treeErrorDetail.value = '';
    treeErrorLink.value = '';
    try {
      const workspaces: DingtalkWorkspaceView[] = [];
      let nextToken: string | undefined;
      const seenTokens = new Set<string>();
      do {
        const page = await DingtalkNotifyApi.workspaces(appKey, {
          next_token: nextToken,
          operator_union_id: operatorUnionId,
        });
        workspaces.push(...page.items);
        nextToken = page.next_token || undefined;
        if (nextToken && seenTokens.has(nextToken)) break;
        if (nextToken) seenTokens.add(nextToken);
      } while (nextToken);

      const selectedValue = treeValue.value;
      const selectedNode = findTreeNode(treeNodes.value, selectedValue);
      if (
        request !== treeRequest ||
        appKey !== form.app_key ||
        operatorUnionId !== form.operator_union_id.trim()
      ) {
        return;
      }
      treeNodes.value = workspaces.map((workspace) => {
        const value = treeNodeValue(
          workspace.workspace_id,
          workspace.root_node_id,
        );
        return {
          isLeaf: false,
          key: value,
          node_id: workspace.root_node_id,
          path: `${workspace.name}/根目录`,
          title: workspace.name,
          value,
          workspace_id: workspace.workspace_id,
        };
      });
      const selectedRoot = selectedNode
        ? treeNodes.value.find(
            (root) => root.workspace_id === selectedNode.workspace_id,
          )
        : undefined;
      if (
        selectedRoot &&
        selectedNode &&
        selectedNode.node_id !== selectedRoot.node_id
      ) {
        await loadTreeChildren(selectedRoot);
        if (!findTreeNode(selectedRoot.children ?? [], selectedValue)) {
          selectedRoot.children = [
            selectedNode,
            ...(selectedRoot.children ?? []),
          ];
          treeNodes.value = [...treeNodes.value];
        }
      }
    } catch (error) {
      const detail = dingtalkKnowledgeError(error);
      treeError.value = detail.message;
      treeErrorDetail.value = detail.detail;
      treeErrorLink.value = detail.link;
    } finally {
      if (request === treeRequest) {
        treeLoading.value = false;
      }
    }
  }

  async function loadTreeChildren(dataNode: unknown) {
    const eventNode = dataNode as KnowledgeTreeNode;
    const node = findTreeNode(treeNodes.value, eventNode.value) ?? eventNode;
    if (node.isLeaf || node.children) return;
    const appKey = form.app_key;
    const operatorUnionId = form.operator_union_id.trim();
    if (!appKey || !operatorUnionId) return;

    const folders: DingtalkNodeView[] = [];
    let nextToken: string | undefined;
    const seenTokens = new Set<string>();
    do {
      const page = await DingtalkNotifyApi.nodes(appKey, node.workspace_id, {
        next_token: nextToken,
        operator_union_id: operatorUnionId,
        parent_node_id: node.node_id,
      });
      folders.push(...page.items.filter((item) => item.node_type === 'FOLDER'));
      nextToken = page.next_token || undefined;
      if (nextToken && seenTokens.has(nextToken)) break;
      if (nextToken) seenTokens.add(nextToken);
    } while (nextToken);

    if (
      appKey !== form.app_key ||
      operatorUnionId !== form.operator_union_id.trim()
    ) {
      return;
    }
    node.children = folders.map((item) => {
      const value = treeNodeValue(node.workspace_id, item.node_id);
      return {
        isLeaf: !item.has_children,
        key: value,
        node_id: item.node_id,
        path: `${node.path}/${item.name}`,
        title: item.name,
        value,
        workspace_id: node.workspace_id,
      };
    });
    treeNodes.value = [...treeNodes.value];
  }

  function selectTreeNode(_value: unknown, option: unknown) {
    const eventNode = option as KnowledgeTreeNode;
    const node = findTreeNode(treeNodes.value, eventNode.value) ?? eventNode;
    treeValue.value = node.value;
    form.workspace_id = node.workspace_id;
    form.parent_node_id = node.node_id;
    form.parent_node_path = node.path;
  }

  return {
    loadTreeChildren,
    loadTreeRoots,
    onAppChange,
    onOperatorChange,
    operatorLoading,
    operatorOptions,
    prepare,
    refreshOperators: () => loadOperators(),
    selectTreeNode,
    treeLoading,
    treeError,
    treeErrorDetail,
    treeErrorLink,
    treeNodes,
    treeValue,
  };
}

function toOperatorTreeOption(
  node: DingtalkOperatorTreeNode,
): OperatorTreeOption {
  return {
    children: [
      ...node.users.map((user) => ({
        title: operatorLabel(user),
        value: user.union_id,
      })),
      ...node.children.map((child) => toOperatorTreeOption(child)),
    ],
    selectable: false,
    title: node.dept_name,
    value: `dept:${node.dept_id}`,
  };
}

function operatorLabel(operator: DingtalkOperatorOption) {
  if (operator.mobile) {
    return `${operator.display_name} (${operator.mobile})`;
  }
  return operator.uid && Number(operator.uid) > 0
    ? `${operator.display_name} (#${operator.uid})`
    : operator.display_name;
}

function operatorTreeContains(
  nodes: OperatorTreeOption[],
  value: string,
): boolean {
  return nodes.some(
    (node) =>
      node.value === value || operatorTreeContains(node.children ?? [], value),
  );
}

function findUniqueOperatorByName(
  nodes: DingtalkOperatorTreeNode[],
  displayName: string,
): DingtalkOperatorOption | undefined {
  const normalized = displayName.trim();
  if (!normalized) return undefined;
  const matches = new Map<string, DingtalkOperatorOption>();
  collectOperatorsByName(nodes, normalized, matches);
  return matches.size === 1 ? [...matches.values()][0] : undefined;
}

function collectOperatorsByName(
  nodes: DingtalkOperatorTreeNode[],
  displayName: string,
  matches: Map<string, DingtalkOperatorOption>,
): void {
  for (const node of nodes) {
    for (const user of node.users) {
      if (user.display_name.trim() === displayName) {
        matches.set(user.union_id, user);
      }
    }
    collectOperatorsByName(node.children, displayName, matches);
  }
}

function treeNodeValue(workspaceId: string, nodeId: string) {
  return `${workspaceId}:${nodeId}`;
}

function treeRootFromTarget(
  row: DingtalkKnowledgeTargetCfg,
): KnowledgeTreeNode {
  const rootPath = `${row.workspace_name}/根目录`;
  const root: KnowledgeTreeNode = {
    isLeaf: false,
    key: treeNodeValue(row.workspace_id, row.root_node_id),
    node_id: row.root_node_id,
    path: rootPath,
    title: row.workspace_name,
    value: treeNodeValue(row.workspace_id, row.root_node_id),
    workspace_id: row.workspace_id,
  };
  if (row.parent_node_id !== row.root_node_id) {
    root.children = [
      {
        isLeaf: false,
        key: treeNodeValue(row.workspace_id, row.parent_node_id),
        node_id: row.parent_node_id,
        path: row.parent_node_path,
        title: row.parent_node_path,
        value: treeNodeValue(row.workspace_id, row.parent_node_id),
        workspace_id: row.workspace_id,
      },
    ];
  }
  return root;
}

function findTreeNode(
  nodes: KnowledgeTreeNode[],
  value: string | undefined,
): KnowledgeTreeNode | undefined {
  if (!value) return undefined;
  for (const node of nodes) {
    if (node.value === value) return node;
    const found = findTreeNode(node.children ?? [], value);
    if (found) return found;
  }
  return undefined;
}
