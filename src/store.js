import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import webSocketReducer, { setPumpMessage }  from "./slice/webSocketSlice"
import { sendNotification } from "./components/notifications";

const listnerMiddleware = createListenerMiddleware();

listnerMiddleware.startListening({
    actionCreator:setPumpMessage,
    effect: async(action)=>{
         // Send notification only when tab is inactive
         if(document.visibilityState ==="hidden"){
            sendNotification("Pump Update",action.payload)
         }
    }
})
const store = configureStore({
    reducer:{
        websocket:webSocketReducer
    },
    middleware:(getDefaultMiddleware)=>[
        ...getDefaultMiddleware(),listnerMiddleware.middleware
    ]
})

export default store;