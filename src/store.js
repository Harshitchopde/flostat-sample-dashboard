import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import webSocketReducer, { setPumpMessage, setTopics }  from "./slice/webSocketSlice"
import { sendNotification } from "./components/notifications";
import { subscribe } from "./components/webSocketService2";

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
// for topic subscripe
listnerMiddleware.startListening({
    actionCreator:setTopics,
    effect: async(action)=>{
        // subscribe to all topic
        action.payload.forEach(topic => {
            subscribe(topic)
        });
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