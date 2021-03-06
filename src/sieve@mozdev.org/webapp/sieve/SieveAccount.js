/* 
 * The content of this file is licensed. You may obtain a copy of
 * the license at https://github.com/thsmi/sieve/ or request it via 
 * email from the author.
 * 
 * Do not remove or change this comment. 
 * 
 * The initial author of the code is:
 *   Thomas Schmid <schmid-thomas@gmx.net>
 */

"use strict";

function SieveAccount() {	
}

SieveAccount.prototype = {
	
  getHost : function() {    
    return {
      isTLSEnabled : function() {
        return true;
      },
  
      isTLSForced : function() {
        return false;
      },
      
      getHostname : function() {
        return "pop.kundenserver.de";
      },
      
      getPort : function() {
        return 2000;
      }
    };
  },
    
  getLogin : function() {
    return {
      hasUsername : function() {
        return true;
      },
      getUsername : function() {
        //return $("#username").val();
      	return "XXXX";
      },
      getPassword : function() {
        //return $("#password").val();
      	return "YYYY";
      }
    };
  },
    
  getAuthorization : function() {
    return {
      getAuthorization : function() {
        return "";
      }
    };
  },
  
  getProxy : function() {
  	return {
  	  getProxyInfo : function() {
  	    return null;
  	  }
  	};
  },
    
  getSettings : function () {
    return {
      getDebugFlags : function() {
        return 255;
      },
      
      hasForcedAuthMechanism : function() {
        return false;
      },
      
      isKeepAlive : function() {
        return true;  
      },
      
      getKeepAliveInterval : function() {
        return 20*60*1000;
      }
    };
   }
};