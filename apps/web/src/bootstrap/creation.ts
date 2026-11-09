import { createApp, watch, type App } from "vue";
import { createPinia } from "pinia";
import { createPersistedState } from "pinia-plugin-persistedstate";
import type { UserSession } from "@toonflow/multi-tenant-user-web/types";
import { actualPlatform } from "@/lib/platform";

export async function createCreationApp(session: UserSession): Promise<App<Element>> {
  // ACT: 创作端的模块会注册设备轮询和 MCP 等能力；确认身份后才加载，登录页不接触全局设置。
  const [
    { default: appRoot }, { default: router }, { loadSettings, settingsStorage, multiTenantEnabled }, { registerLanguage },
    { registerAnonymousData }, { registerDownloads }, { registerDesktopProtocol }, { registerDesktopAutoUpdate },
  ] = await Promise.all([
    import("@/App.vue"), import("@/router"), import("@/stores/settings"), import("@/lib/i18n"),
    import("@/lib/anonymousData"), import("@/lib/saveFile"), import("@/lib/desktopProtocol"), import("@/stores/desktopUpdate"),
  ]);
  await loadSettings();
  const app = createApp(appRoot);
  app.onUnmount(registerLanguage());
  app.use(createPinia().use(createPersistedState({ storage: settingsStorage })));
  app.use(router);
  await router.isReady();
  // fork: 不注册匿名数据上报
  void registerAnonymousData;
  app.onUnmount(registerDownloads());
  if (!session.publicWeb) app.onUnmount(watch(multiTenantEnabled, enabled => { if (enabled) window.location.reload(); }));
  if (actualPlatform.isLocalDesktop && !session.publicWeb) {
    app.onUnmount(registerDesktopProtocol());
    // fork: 关闭自动更新，避免被官方版本覆盖
    void registerDesktopAutoUpdate;
  }
  return app;
}
