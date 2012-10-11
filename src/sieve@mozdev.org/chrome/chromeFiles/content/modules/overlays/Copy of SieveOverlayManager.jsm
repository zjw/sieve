// Enable Strict Mode
"use strict";  

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

var EXPORTED_SYMBOLS = [ "SieveOverlayUtils","SieveOverlayManager" ];

var SieveOverlayUtils =
{
  addTabType : function (aTabType,tabmail)
  {  
    if ( !tabmail )
      throw "adding extension failed";
      
    tabmail.registerTabType(aTabType); 
  },  

  removeTabType : function (aTabType,tabmail)
  {
    Cu.reportError("Remove Tabtypes");
    
    if (!aTabType || !aTabType.name)
      throw "Invalid Tabtype"+aTabType.name;
      
    if (!tabmail)
      throw "Invalid Tabmail"+tabmail;
    
    if (!tabmail.tabTypes)
      throw "Invalid tabtypes"+tabmail.tabTypes;
      
    Cu.reportError("Tabtype Name"+aTabType.name);  
    Cu.reportError("Tabtypes"+tabmail.tabTypes);  
      
    if ((aTabType.name in tabmail.tabTypes) == false)
      return;
 
    for (let [modeName] in Iterator(aTabType.modes))
    {
      if ( !tabmail.tabModes[modeName])
        continue;
        
      while (tabmail.tabModes[modeName].tabs.length)
      {
        // TODO we need a force close here....
        tabmail.closeTab(tabmail.tabModes[modeName].tabs[0],true)
        // Sleep -> Sync
        Cu.reportError("tabs open3...");
        // TODO close tabs...
      }
        
      delete tabmail.tabModes[modeName];
    }
    
    delete tabmail.tabTypes[aTabType.name]; 
    
    if (aTabType.name in tabmail.tabTypes)
      throw "error";
  },

  addToolBarItem : function (document,toolbox, button)
  { 
      
    toolbox.palette.appendChild(button);
    
    // now it's getting ugly, the toolbar is already initialzed, so our button
    // is missing.
  
    // At first we are looking for toolbars containing a currentset 
    // attribute with our id. The current set attribute is used to restore
    // the toolbar and does not change.
    var toolbars = document.querySelectorAll('toolbar[currentset*="'+button.id+'"]');

    // we need to loop through all toolbars as querySelector's can't match
    // attributes containing kommas. So we have to do that on our own.
    for (var i=0; i<toolbars.length; i++)
    {      
      var currentset = toolbars[i].getAttribute("currentset").split(",");
      var pos = currentset.indexOf(""+button.id);
      
      if (pos == -1 )
        continue;
        
      var sib = null;
      var offset = 0;
      
      // we are now looking for the element directly behind us...
      while (pos < currentset.length-1)
      {
        pos++;
  
        // these types are hardcoded in toolbar.xml and have no real Id
        // so we have no chance to find them. So we need a hack...
        switch (currentset[pos])
        {
          case "separator":
          case "spring":
          case "spacer":
            offset++;
            Cu.reportError("OFFSET")
            continue;
        }
       
        // ... all other elements can be found.
        var sel = "#"+currentset[pos];
        Cu.reportError("SEL: "+sel)
        
        sib = toolbars[i].querySelector(sel);
        
        if (sib)
          break;
      }

      if (!sib && offset)
      {
        sib = toolbars[i].lastChild;
        offset--;
        Cu.reportError("AA "+sib.id);
      }
        
      while (sib && offset--)
      {
        sib = sib.previousSibling;
        Cu.reportError("BB "+sib.id);
      }
        
      toolbars[i].insertItem(""+button.id,sib);
    }    
  },
  
  removeToolBarItem: function(item)
  {    
    item.parentNode.removeChild(item); 
  },  
  
  addMenuItem : function (document,item,sibling)
  {  
    sibling.parentNode.insertBefore(item,sibling);  
  },
  
  removeMenuItem : function(item)
  {
    item.parentNode.removeChild(item);    
  },
  
  addStyleSheet : function(document,url)
  {
    var style = document.createProcessingInstruction(
                   "xml-stylesheet",
                   'href="'+url+'" "type="text/css"');
    document.insertBefore(style,document.documentElement);     
  },

  removeStyleSheet : function (document,url)
  {
    for (var i=document.styleSheets.length-1; i>= 0; i--) 
    {
      if (document.styleSheets[i].href != url)
        continue;
        
      Cu.reportError(document.styleSheets[i].ownerNode);
      
      document.styleSheets[i].ownerNode.parentNode.removeChild(document.styleSheets[i].ownerNode)
    }    
  }   
}

// TODO scripts should pass an unique identifier like 
// "Sieve.Accounts", "Sieve.Session", "Sieve.AutoConfig" instead
// of an url
//
// SieveAccounts.js, SieveSessions.js and SieveAutoConfig need
// to register at SieveOverlayManager and declare their imports
// as chrome urls on which marschalling should work.
//
// SOM.manage("sieve.session",aUrl, ["chrome://...","chrome://...",...]);
//
// within ui code:
// SOM.require("sieve.session",scope,window) 
// java scrip scope is where to add the import, the global object is alys picked
// window the object to wich this import is bound if the window is gone the import 
// might be released. If null lifetime is boud to bootstrap and will be reasesed 
// upon shutdown.
//
// within modules:
// SOM.require(chrome://) 
// checks if a window is registered or this url if not an exeption is thrown.
// if yes the code is managed an imported into callers global object..
// safe require, manage

var SieveOverlayManager =
{
  _overlays : [],
  _windowTypes : {},
  _imports : {},
  _windows : {},
  _watcher : {},
  
  /**
   * The pattern behind javacript modules is a singleton. 
   * 
   * Import evalutes a Module only upon first access and cached. Any subsequent 
   * call gets a reference to this cached module. So it's safe to be called
   * multiple times
   * 
   * Unload removes and destroys this cache. If it calles the module is 
   * removed from memory.
   * 
   * This makes it difficuls to ensure unloading modules when they are no
   * more needed. An easy solution is a simple carbage collector. It binds 
   * a Module to a window. As soon as a module has no references to a window 
   * it can be unloaded.
   *  
   * @param {} aUrl
   *   the url to the module which should be loaded
   * @param {} scope
   *   the scope the module should be loaded. The module is always lodaded into 
   *   the scopes global module.
   * @param {} aWindow
   *   the window a module should be bound to
   */
  // TODO rename into loadModule
  require : function(aUrl,aScope,aWindow)
  { 
    if (aUrl.substr(0,15) != "chrome://sieve/")
      aUrl = "chrome://sieve/content/modules" +aUrl;
    
    Cu.reportError("Load Module "+aUrl)
    if (aScope)
      Cu.import(aUrl,Cu.getGlobalForObject(aScope));  
    
    // if we have no window, we can collect this module
    if(typeof(aWindow) == "undefined")
      return;  
      
    // map windows to urls...
    if (!this._windows[aWindow])
      this._windows[aWindow] = [];
      
    if (this._windows[aWindow].indexOf(aUrl) == -1)
      this._windows[aWindow].push(aUrl);
      
    // ... and one urls to windows
    if (!this._imports[aUrl])
      this._imports[aUrl] = [];
      
    if (this._imports[aUrl].indexOf(aWindow) == -1)
      this._imports[aUrl].push(aWindow);
    
    SieveOverlayManager.loadWatcher(aWindow);
    // Dendencies:
    // The scope is null, as the might load these modules on demand. So we... 
    // ... are just binding the url to this window. Releasing an unused...
    // ... url is not an error, but fogetting to release one is a memory...
    // ... hole
    
    // Sieve Connection Manager depends a Session
    if (aUrl == "chrome://sieve/content/modules/sieve/SieveConnectionManager.js")
      SieveOverlayManager.require("/sieve/SieveSession.js",null,aWindow);
      
    // Session depend on Sieve
    if (aUrl == "chrome://sieve/content/modules/sieve/SieveSession.js")
    {
      SieveOverlayManager.require("/sieve/Sieve.js",null,aWindow);
      SieveOverlayManager.require("/sieve/SieveAccounts.js",null,aWindow);
    }
    
    // ... same applies to autoconfig
    if (aUrl == "chrome://sieve/content/modules/sieve/SieveAutoConfig.js")
      SieveOverlayManager.require("/sieve/Sieve.js",null,aWindow);
    
    // Sieve depends on request and responses 
    if (aUrl == "chrome://sieve/content/modules/sieve/Sieve.js")
    {
      SieveOverlayManager.require("/sieve/SieveRequest.js",null,aWindow);
      SieveOverlayManager.require("/sieve/SieveResponse.js",null,aWindow);
      SieveOverlayManager.require("/sieve/SieveResponseCodes.js",null,aWindow);
      SieveOverlayManager.require("/sieve/SieveResponseParser.js",null,aWindow);      
    }      
  },
  
  /**
   * Releases a url bund to thi window...
   * @param {} window
   * @param {} url
   */
  unloadModules : function(aWindow)
  {  
    if (typeof(aWindow) == undefined)
    {
      for (var item in this._imports)
      {
        Cu.reportError("Unloading Module"+item);
        Cu.unload(item);
      }
      
      for (var item in this._windows)
        delete this._windows[item];
        
      for (var item in this._imports)
        delete this._imports[item];
          
      return;
    }
    
    if (!this._windows[aWindow])
      return;
        
    // retrieve a window's imports...
    var imports = this._windows[aWindow];
    
    // ...then check if they are used by an other window.
    for (var i=0; i<imports.length; i++)
    {
      // get all windows which is using this import/module
      var windows = this._imports[imports[i]];
      
      // we can skip if we are not in that list. If we never used
      // this import we can't unload it.
      if(windows.indexOf(aWindow) == -1)
        continue;
      
      // does anyone else use this url?
      if (windows.length >= 1)
      {
        // yes, remove any traces to our window form the url map...
        this._imports[imports[i]].splice(windows.indexOf(aWindow),1);
        continue;
      }
      
      Cu.reportError("Unloading Module"+imports[i]);
      // no one uses this module, so get rid of the map
      Cu.unload(imports[i]);
      delete (this._imports[imports[i]]);
    } 
    
    // finally release the window
    delete(this._windows[aWindow]);
  },
  
  // nsIWindowMediatorListener functions
  onOpenWindow: function(window)
  {
    Cu.reportError("On Open Window "+window)
    
    // A new window has opened
    var domWindow = window.QueryInterface(Ci.nsIInterfaceRequestor)
                             .getInterface(Ci.nsIDOMWindowInternal);

    // Wait for it to finish loading
    domWindow.addEventListener("load", function listener() {
      domWindow.removeEventListener("load", listener, false);

      SieveOverlayManager.loadOverlays(domWindow);
    
    }, false);
  },

  onCloseWindow: function(aWindow)
  {  
  },
  
  onUnloadWindow : function (aEvent)
  { 
    var window = aEvent.currentTarget;
    
    window = window.QueryInterface(Ci.nsIInterfaceRequestor)
                       .getInterface(Ci.nsIDOMWindow);  
                        
    Cu.reportError("Unloading window "+window.document.baseURI);
    
    SieveOverlayManager.unloadWatcher(window);
    SieveOverlayManager.unloadOverlays(window);
    SieveOverlayManager.unloadModules(window);
    
    Cu.reportError("Unloading window completed "+window);  
  },
  
  onWindowTitleChange: function(window, newTitle) { },

  loadWatcher : function(aWindow)
  {   
    aWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                        .getInterface(Ci.nsIDOMWindow);  
             
    Cu.reportError("Register Unloading Watcher"+aWindow.document.baseURI);
    
    // watcher already existing...
    if (this._watcher[aWindow] == true)
      return; 
      
    Cu.reportError("Register Unloading Watcher 2"+aWindow.document.baseURI);
    aWindow.addEventListener("unload", SieveOverlayManager.onUnloadWindow);
    this._watcher[aWindow] = true;
  },
  
  unloadWatcher : function(aWindow)
  {
   Cu.reportError("Deregister Unloading Watcher");                   
      
   if (typeof(aWindow) == "undefined")
    {
      for (var item in this._watcher)
        item.removeEventListener("unload", SieveOverlayManager.onUnloadWindow);
        
      this._watcher = [];
      return;
    }

    aWindow = aWindow.QueryInterface(Ci.nsIInterfaceRequestor)
                        .getInterface(Ci.nsIDOMWindow);     
                        
   Cu.reportError("Deregister Unloading Watcher"+aWindow.document.baseURI);  
 
    aWindow.removeEventListener("unload", SieveOverlayManager.onUnloadWindow, true);
    delete this._watcher[aWindow];
  },
  
  // ...
  addOverlay : function (overlay,type)
  {
    if ( !this._windowTypes[type] ) 
      this._windowTypes[type] = [];
      
    this._windowTypes[type].push(overlay);
  },
  
  /**
   * Apply ovrlays to window
   * @param {} window
   */
  loadOverlays : function (window)
  { 
    var windowtype = window.document.documentElement.getAttribute("windowtype");
    
    Components.utils.reportError("Windowtype:"+windowtype)
    
    if (!windowtype)
      return;
    
    if (!this._windowTypes[windowtype])
      return;
    
    SieveOverlayManager.loadWatcher(window);
      
    for (var i=0; i<this._windowTypes[windowtype].length; i++)
    {
      let overlay = new (this._windowTypes[windowtype][i])();
      this._overlays.push(overlay);
      overlay.load(window);
     
      Components.utils.reportError("Overlaying!...") 
    }
  },
  
  /**
   * Remove applied overlays from window...
   * @param {} window
   */
  unloadOverlays : function(window)
  {
    
    // a shortcut if we want to get rid of all Overlways
    if (typeof(window) == "undefined")
    {
      while (this._overlays.length)
        var overlay = this._overlays.pop().unload();
      
      return;
    }
    
    // we mutate the array thus we interate backwards...
    for (var i=SieveOverlayManager._overlays.length-1; i>=0; i--)
    {
      Cu.reportError("Comp Overlay...:"+SieveOverlayManager._overlays[i].window+" "+window) 
      if (SieveOverlayManager._overlays[i].window != window)
        continue;
        
      Components.utils.reportError("Clenup Overlay...") 
      SieveOverlayManager._overlays[i].unload();
      SieveOverlayManager._overlays.splice(i,1);
    }
  },
  
  load : function()
  {
    Components.utils.reportError("Load called!...") 
    // Step 2: Inject code into UI
    var wm = Cc["@mozilla.org/appshell/window-mediator;1"].
               getService(Ci.nsIWindowMediator);

    var windows = wm.getEnumerator(null);
    while (windows.hasMoreElements())
    {
      var domWindow = windows.getNext().QueryInterface(Ci.nsIDOMWindow);
      SieveOverlayManager.loadOverlays(domWindow);
    }

    // Wait for any new browser windows to open
    wm.addListener(this);
  },
  
  unload : function() {
   Components.utils.reportError("Unloadcalleds!...") 
                 
   SieveOverlayManager.unloadWatcher();
   SieveOverlayManager.unloadOverlays();
   SieveOverlayManager.unloadModules();

    var wm = Cc["@mozilla.org/appshell/window-mediator;1"].
                 getService(Ci.nsIWindowMediator);
                 
    wm.removeListener(this);
        
    delete this._windowTypes;        
  }
}

