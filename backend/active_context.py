"""
Cross-platform active application context detection.

Gets information about the frontmost application including:
- Application name
- Window title
- URL (for browsers)

Supports macOS and Windows.
"""

import logging
import sys

logger = logging.getLogger(__name__)

IS_MACOS = sys.platform == "darwin"
IS_WINDOWS = sys.platform == "win32"

# Platform-specific imports
if IS_MACOS:
    try:
        import objc
        from AppKit import NSWorkspace
        import ApplicationServices
        MACOS_AVAILABLE = True
    except ImportError:
        MACOS_AVAILABLE = False
        logger.warning("macOS frameworks not available")

elif IS_WINDOWS:
    try:
        import ctypes
        from ctypes import wintypes
        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32
        psapi = ctypes.windll.psapi

        # Process access flags
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        PROCESS_VM_READ = 0x0010

        WINDOWS_AVAILABLE = True
    except Exception as e:
        WINDOWS_AVAILABLE = False
        logger.warning(f"Windows APIs not available: {e}")
else:
    MACOS_AVAILABLE = False
    WINDOWS_AVAILABLE = False


# ============================================================================
# macOS Implementation
# ============================================================================

def get_ax_attribute(element, attr_name):
    """Helper to safely get an accessibility attribute (macOS)."""
    if not IS_MACOS or not MACOS_AVAILABLE:
        return None
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
    if not IS_MACOS or not MACOS_AVAILABLE:
        return {}

    queue = [element]
    visited = set()
    url = None
    title = get_ax_attribute(element, "AXTitle")

    while queue:
        curr = queue.pop(0)

        if len(visited) > 1000:
            break
        visited.add(curr)

        val = get_ax_attribute(curr, "AXValue")
        if val and isinstance(val, str) and (val.startswith("http://") or val.startswith("https://") or "://" in val):
            url = val
            break

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


def get_frontmost_app_macos():
    """Uses NSWorkspace to get the frontmost application (macOS)."""
    if not IS_MACOS or not MACOS_AVAILABLE:
        return None
    try:
        workspace = NSWorkspace.sharedWorkspace()
        active_app = workspace.frontmostApplication()
        return active_app
    except Exception as e:
        logger.error(f"Error getting frontmost app via NSWorkspace: {e}")
        return None


def get_active_context_macos() -> dict:
    """Gets active application context on macOS using PyObjC."""
    app = get_frontmost_app_macos()
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


# ============================================================================
# Windows Implementation
# ============================================================================

def get_foreground_window_info_windows() -> dict:
    """Gets information about the foreground window on Windows."""
    if not IS_WINDOWS or not WINDOWS_AVAILABLE:
        return {}

    try:
        hwnd = user32.GetForegroundWindow()
        if not hwnd:
            return {}

        # Get window title
        length = user32.GetWindowTextLengthW(hwnd)
        if length > 0:
            title_buffer = ctypes.create_unicode_buffer(length + 1)
            user32.GetWindowTextW(hwnd, title_buffer, length + 1)
            window_title = title_buffer.value
        else:
            window_title = ""

        # Get process ID
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

        # Get process name
        app_name = ""
        process_handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, False, pid.value)
        if process_handle:
            try:
                exe_path = ctypes.create_unicode_buffer(260)
                size = wintypes.DWORD(260)
                if kernel32.QueryFullProcessImageNameW(process_handle, 0, exe_path, ctypes.byref(size)):
                    # Extract just the executable name
                    full_path = exe_path.value
                    app_name = full_path.split("\\")[-1]
                    # Remove .exe extension for cleaner display
                    if app_name.lower().endswith(".exe"):
                        app_name = app_name[:-4]
            finally:
                kernel32.CloseHandle(process_handle)

        context = {"app": app_name or "Unknown"}

        if window_title:
            context["title"] = window_title

            # Try to extract URL from browser window titles
            # Many browsers include the page title followed by the browser name
            browsers = ["Chrome", "Firefox", "Edge", "Safari", "Opera", "Brave"]
            for browser in browsers:
                if browser.lower() in app_name.lower() or f"- {browser}" in window_title:
                    # The URL bar content isn't directly accessible without UI Automation
                    # but the window title often contains useful context
                    break

        return context

    except Exception as e:
        logger.error(f"Error getting Windows foreground window info: {e}")
        return {}


def get_active_context_windows() -> dict:
    """Gets active application context on Windows."""
    return get_foreground_window_info_windows()


# ============================================================================
# Cross-Platform Interface
# ============================================================================

def get_frontmost_app():
    """Gets the frontmost application. Cross-platform wrapper."""
    if IS_MACOS:
        return get_frontmost_app_macos()
    elif IS_WINDOWS:
        # Return a dict-like object for Windows
        info = get_foreground_window_info_windows()
        return info if info else None
    return None


def get_active_context() -> dict:
    """Combines application and browser context into a single dictionary. Cross-platform."""
    if IS_MACOS and MACOS_AVAILABLE:
        return get_active_context_macos()
    elif IS_WINDOWS and WINDOWS_AVAILABLE:
        return get_active_context_windows()
    return {}


if __name__ == "__main__":
    import json
    # No extensive logging so stdout remains pure JSON
    print(json.dumps(get_active_context()))
