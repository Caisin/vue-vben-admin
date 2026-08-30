import type { NotifyChannelType } from '#/api/notify';

export interface NotifyConfigGuide {
  links: Array<{ label: string; url: string }>;
  steps: string[];
  title: string;
}

const DINGTALK_APP_CONSOLE = 'https://open-dev.dingtalk.com/fe/app';
const DINGTALK_WEB = 'https://im.dingtalk.com/';
export const DINGTALK_OPEN_CONVERSATION_ID_DOC =
  'https://open.dingtalk.com/document/orgapp/obtain-group-openconversationid';

const FIREBASE_CONSOLE = 'https://console.firebase.google.com/';
const GOOGLE_CLOUD_IAM =
  'https://console.cloud.google.com/iam-admin/serviceaccounts';

export const customRobotGuide: NotifyConfigGuide = {
  links: [
    {
      label: '自定义机器人文档',
      url: 'https://open.dingtalk.com/document/robots/custom-robot-access',
    },
    {
      label: '获取群会话 ID',
      url: DINGTALK_OPEN_CONVERSATION_ID_DOC,
    },
    { label: '打开钉钉网页版', url: DINGTALK_WEB },
  ],
  steps: [
    '进入目标群的机器人管理，添加自定义机器人并选择安全设置。',
    '复制完整 Webhook；需要给群授予周报编辑权限时，按“获取群会话 ID”文档取得 open_conversation_id。',
    '系统从 Webhook 自动识别 access_token；群会话 ID 留空时仍发送链接，但不执行文档群授权。',
  ],
  title: '钉钉自定义群机器人配置',
};

export const groupRobotGuide: NotifyConfigGuide = {
  links: [
    {
      label: '企业机器人文档',
      url: 'https://open.dingtalk.com/document/development/development-robot-overview',
    },
    {
      label: '获取群会话 ID',
      url: DINGTALK_OPEN_CONVERSATION_ID_DOC,
    },
    { label: '打开钉钉开放平台', url: DINGTALK_APP_CONSOLE },
  ],
  steps: [
    '在钉钉开放平台创建企业内部应用并启用机器人能力。',
    '在目标群安装机器人；群内 @机器人 后可从消息回调复制 conversationId，也可按文档由 chatId 转换。',
    '先在钉钉推送配置保存企业群机器人，再在消息通道的 Provider 配置下拉框中选择它。',
  ],
  title: '钉钉企业群机器人配置',
};

export const firebasePushGuide: NotifyConfigGuide = {
  links: [
    {
      label: 'Firebase Cloud Messaging 文档',
      url: 'https://firebase.google.com/docs/cloud-messaging',
    },
    { label: '打开 Firebase 控制台', url: FIREBASE_CONSOLE },
    { label: '服务账号控制台', url: GOOGLE_CLOUD_IAM },
  ],
  steps: [
    '在 Firebase 控制台创建或选择项目，确认 Android / iOS App 已接入 Firebase SDK 并能上报注册 token。',
    '在 Google Cloud 服务账号中创建具备 Firebase Cloud Messaging 发送权限的服务账号，并下载 JSON 密钥。',
    '在凭证中心新增 Firebase 服务账号凭证，类型选择 google_service_account / firebase_fcm，并上传完整 JSON。',
    '在消息通道中选择 Firebase 推送，再从 Provider 配置下拉框选择该凭证；推送消息 payload 必须携带有效 endpoint_id。',
  ],
  title: 'Firebase Cloud Messaging 推送配置',
};

export const knowledgeTargetGuide: NotifyConfigGuide = {
  links: [
    {
      label: '知识库概览文档',
      url: 'https://open.dingtalk.com/document/development/knowledge-base-overview',
    },
    {
      label: '获取知识库列表文档',
      url: 'https://open.dingtalk.com/document/development/get-knowledge-base-list',
    },
    {
      label: '获取知识库详情文档',
      url: 'https://open.dingtalk.com/document/development/obtain-the-knowledge-base',
    },
    { label: '打开钉钉开放平台', url: DINGTALK_APP_CONSOLE },
  ],
  steps: [
    '在钉钉开放平台为企业内部应用开通知识库、文档与表格权限。',
    '选择具备目标目录权限的在职钉钉操作人；当前账号有对应组织映射时默认选择本人。',
    '在知识库目录树中展开并选择根目录或文件夹，保存为创建周报 WORKBOOK 的稳定发布目标。',
  ],
  title: '钉钉知识库目标配置',
};

export const channelConfigGuides: Partial<
  Record<NotifyChannelType, NotifyConfigGuide>
> = {
  dingtalk_custom_robot: customRobotGuide,
  dingtalk_group_bot: groupRobotGuide,
  push: firebasePushGuide,
};
