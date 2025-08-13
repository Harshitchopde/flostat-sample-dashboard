import { configureStore } from "@reduxjs/toolkit";
import webSocketReducer  from "./slice/webSocketSlice"
const store = configureStore({
    reducer:{
        websocket:webSocketReducer
    },
})

export default store;