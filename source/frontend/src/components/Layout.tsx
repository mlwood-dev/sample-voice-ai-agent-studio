import { Outlet, useLocation } from 'react-router-dom';
import { BottomTabs, SideNav, pathShowsTabs } from '../studio/Nav';
import AutoSaveIndicator from './AutoSaveIndicator';
import styles from './Layout.module.css';

function Layout() {
  const { pathname } = useLocation();
  const live = pathname === '/poc';
  const showTabs = pathShowsTabs(pathname);

  if (live) {
    return <Outlet />;
  }

  return (
    <div className={styles.shell}>
      <SideNav />
      <div className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
        <AutoSaveIndicator />
        {showTabs && (
          <div className={styles.tabsSlot}>
            <BottomTabs />
          </div>
        )}
      </div>
    </div>
  );
}

export default Layout;
