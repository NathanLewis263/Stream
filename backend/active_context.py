import logging
import objc
from AppKit import NSWorkspace
import ApplicationServices

logger = logging.getLogger(__name__)

def get_frontmost_app():
    """Uses NSWorkspace to get the frontmost application. Note: when imported into a long-running process, this caches!"""
    try:
        workspace = NSWorkspace.sharedWorkspace()
        active_app = workspace.frontmostApplication()
        return active_app
    except Exception as e:
        logger.error(f"Error getting frontmost app via NSWorkspace: {e}")
        return None

def get_ax_attribute(element, attr_name):
    """Helper to safely get an accessibility attribute."""
    try:
        err, val = ApplicationServices.AXUIElementCopyAttributeValue(element, attr_name, None)
        if err == 0:
            return val
    except Exception:
        pass
    return None

def find_browser_context_bfs(element):
    """
    Performs a limited Breadth-First Search on AXUIElements to find URL and Title.
    Browsers expose the active tab differently, so scanning the tree is more robust.
    """
    queue = [element]
    visited = set()
    url = None
    title = get_ax_attribute(element, "AXTitle")
    
    while queue:
        curr = queue.pop(0)
        
        # Limit search depth/breadth to avoid hangs
        if len(visited) > 1000:
            break
        visited.add(curr)
        
        # 1. Try AXValue on text fields/combo boxes
        val = get_ax_attribute(curr, "AXValue")
        if val and isinstance(val, str) and (val.startswith("http://") or val.startswith("https://") or "://" in val):
            url = val
            break
            
        # 2. Try AXURL directly (Safari often does this)
        ax_url = get_ax_attribute(curr, "AXURL")
        try:
            if ax_url and hasattr(ax_url, 'absoluteString'):
                url = ax_url.absoluteString()
                break
            elif ax_url and isinstance(ax_url, str):
                url = ax_url
                break
        except Exception:
            pass
            
        children = get_ax_attribute(curr, "AXChildren")
        if children:
            for child in children:
                queue.append(child)
                
    return {"url": url, "title": title} if url or title else {}

def get_active_context() -> dict:
    """Combines application and browser context into a single dictionary using PyObjC."""
    app = get_frontmost_app()
    if not app:
        return {}
    
    app_name = app.localizedName()
    pid = app.processIdentifier()
    
    context = {"app": app_name}
    
    try:
        app_element = ApplicationServices.AXUIElementCreateApplication(pid)
        windows = get_ax_attribute(app_element, "AXWindows")
        if windows and len(windows) > 0:
            main_win = windows[0]
            browser_info = find_browser_context_bfs(main_win)
            
            if browser_info.get("url"):
                context["url"] = browser_info["url"]
            if browser_info.get("title"):
                context["title"] = browser_info["title"]
    except Exception as e:
        logger.error(f"Error getting broader context for {app_name} via AXUIElement: {e}")
        
    return context

if __name__ == "__main__":
    import json
    # No extensive logging so stdout remains pure JSON
    print(json.dumps(get_active_context()))
