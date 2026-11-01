package com.example.Kcsj.controller;

import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.example.Kcsj.common.HazardLevel;
import com.example.Kcsj.common.Result;
import com.example.Kcsj.entity.ImgRecords;
import com.example.Kcsj.entity.Message;
import com.example.Kcsj.entity.User;
import com.example.Kcsj.entity.WorkOrder;
import com.example.Kcsj.handler.MessageWebSocketHandler;
import com.example.Kcsj.mapper.ImgRecordsMapper;
import com.example.Kcsj.mapper.MessageMapper;
import com.example.Kcsj.mapper.WorkOrderMapper;
import com.example.Kcsj.mapper.UserMapper;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import javax.annotation.Resource;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;

@RestController
@RequestMapping("/flask")
public class PredictionController {
    @Resource
    ImgRecordsMapper imgRecordsMapper;
    @Resource
    WorkOrderMapper workOrderMapper;
    @Resource
    MessageMapper messageMapper;
    @Resource
    UserMapper userMapper;

    private final RestTemplate restTemplate = new RestTemplate();

    // 定义接收的参数类
    public static class PredictRequest {
        private String startTime;
        private String weight;
        private String username;
        private String inputImg;
        private String conf;
        private String ai;
        private String suggestion;

        public String getUsername() {
            return username;
        }

        public void setUsername(String username) {
            this.username = username;
        }

        public String getStartTime() {
            return startTime;
        }

        public void setStartTime(String startTime) {
            this.startTime = startTime;
        }

        public String getWeight() {
            return weight;
        }

        public void setWeight(String weight) {
            this.weight = weight;
        }

        public String getInputImg() {
            return inputImg;
        }

        public void setInputImg(String inputImg) {
            this.inputImg = inputImg;
        }

        public String getConf() {
            return conf;
        }

        public void setConf(String conf) {
            this.conf = conf;
        }

        public String getAi() {
            return ai;
        }

        public void setAi(String ai) {
            this.ai = ai;
        }

        public String getSuggestion() {
            return suggestion;
        }

        public void setSuggestion(String suggestion) {
            this.suggestion = suggestion;
        }
    }

    @PostMapping("/predict")
    public Result<?> predict(@RequestBody PredictRequest request) {
        if (request == null || request.getInputImg() == null || request.getInputImg().isEmpty()) {
            return Result.error("-1", "未提供图片链接");
        } else if (request.getWeight() == null || request.getWeight().isEmpty()) {
            return Result.error("-1", "未提供权重");
        }

        try {
            // 创建请求体
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<PredictRequest> requestEntity = new HttpEntity<>(request, headers);

            // 调用 Flask API
            String response = restTemplate.postForObject("http://localhost:5000/predictImg", requestEntity, String.class);
//            System.out.println("Received response: " + response);
            JSONObject responses = JSONObject.parseObject(response);
            if(responses.get("status").equals(400)){
                return Result.error("-1", "Error: " + responses.get("message"));
            }else {
                ImgRecords imgRecords = new ImgRecords();
                imgRecords.setWeight(request.getWeight());
                imgRecords.setConf(request.getConf());
                imgRecords.setInputImg(request.getInputImg());
                imgRecords.setUsername(request.getUsername());
                imgRecords.setStartTime(request.getStartTime());
                imgRecords.setAi(request.getAi());
                imgRecords.setLabel(String.valueOf(responses.get("label")));
                imgRecords.setConfidence(String.valueOf(responses.get("confidence")));
                imgRecords.setAllTime(String.valueOf(responses.get("allTime")));
                imgRecords.setOutImg(String.valueOf(responses.get("outImg")));
                imgRecords.setSuggestion(String.valueOf(responses.get("suggestion")));
                imgRecordsMapper.insert(imgRecords);

                String hazardLevel = HazardLevel.normalize(responses.getString("hazard_level"));
                if (hazardLevel != null && !hazardLevel.isEmpty()) {
                    JSONArray labels = responses.getJSONArray("label");
                    String hiddenType = labels != null && !labels.isEmpty() ? labels.getString(0) : "未知隐患";

                    JSONObject rectifyTask = responses.getJSONObject("rectify_task");
                    String responsible = rectifyTask != null ? rectifyTask.getString("duty_person") : "";
                    if (responsible == null || responsible.isEmpty()) {
                        responsible = HazardLevel.defaultResponsible(hazardLevel);
                    }
                    // 保留现有 6 个角色，不再把“现场施工人员”并成“施工班组长”
                    responsible = responsible.replace("施工班组", "施工班组长");

                    String responseTimeout = HazardLevel.responseTimeout(hazardLevel);
                    String rectifyTimeout = HazardLevel.rectifyTimeout(hazardLevel);
                    String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());

                    WorkOrder workOrder = new WorkOrder();
                    workOrder.setOrderNo("WO" + new SimpleDateFormat("yyyyMMddHHmmss").format(new Date()));
                    workOrder.setHiddenType(hiddenType);
                    workOrder.setLevel(hazardLevel);
                    workOrder.setLocation("施工现场");
                    workOrder.setDescription("检测到安全隐患：" + hiddenType);
                    workOrder.setResponsible(responsible);
                    workOrder.setDeadline(rectifyTimeout);
                    workOrder.setResponseDeadline(addMinutes(now, HazardLevel.responseMinutes(hazardLevel)));
                    workOrder.setRectifyDeadline(addMinutes(now, HazardLevel.rectifyMinutes(hazardLevel)));
                    workOrder.setStatus("pending");
                    workOrder.setSuggestion(String.valueOf(responses.get("suggestion")));
                    workOrder.setCreateTime(now);
                    workOrder.setUpdateTime(now);
                    workOrder.setRecordId(imgRecords.getId());
                    workOrderMapper.insert(workOrder);

                    // 检测预警：始终按隐患等级向对应角色推送（不受responsible影响）
                    // responsible仅用于工单责任人字段，不用于推送
                    List<String> pushRoles = HazardLevel.pushRoles(hazardLevel);
                    System.out.println("检测预警推送: hazardLevel=" + hazardLevel
                            + ", 响应=" + responseTimeout + ", 整改=" + rectifyTimeout
                            + ", hiddenType=" + hiddenType + ", pushRoles=" + pushRoles);

                    LambdaQueryWrapper<User> userWrapper = Wrappers.<User>lambdaQuery();
                    userWrapper.in(User::getRole, pushRoles);
                    List<User> users = userMapper.selectList(userWrapper);

                    List<String> userIds = new ArrayList<>();
                    for (User user : users) {
                        userIds.add(user.getUsername());

                        Message message = new Message();
                        message.setUserId(user.getUsername());
                        message.setType("warning");
                        message.setTitle(hazardLevel + "预警");
                        message.setContent("检测到" + hiddenType + "，请及时处理！");
                        message.setCreateTime(workOrder.getCreateTime());
                        message.setIsRead(0);
                        message.setWorkOrderId(workOrder.getId());
                        messageMapper.insert(message);
                    }

                    JSONObject pushMessage = new JSONObject();
                    pushMessage.put("type", "new_message");
                    pushMessage.put("title", hazardLevel + "预警");
                    pushMessage.put("content", "检测到" + hiddenType + "，请及时处理！");
                    pushMessage.put("hazardLevel", hazardLevel);
                    pushMessage.put("hiddenType", hiddenType);
                    pushMessage.put("workOrderId", workOrder.getId());
                    pushMessage.put("createTime", workOrder.getCreateTime());
                    MessageWebSocketHandler.sendMessageToMultipleUsers(userIds, pushMessage.toJSONString());
                }

                return Result.success(response);
            }
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    private String addMinutes(String baseTime, int minutes) {
        Date base;
        try {
            base = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").parse(baseTime);
        } catch (Exception e) {
            base = new Date();
        }
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(base);
        calendar.add(Calendar.MINUTE, minutes);
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(calendar.getTime());
    }

    @GetMapping("/file_names")
    public Result<?> getFileNames() {
        try {
            String response = restTemplate.getForObject("http://127.0.0.1:5000/file_names", String.class);
            return Result.success(response);
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    public static class VideoRequest {
        private String startTime;
        private String weight;
        private String username;
        private String inputVideo;
        private String conf;

        public String getUsername() { return username; }
        public void setUsername(String username) { this.username = username; }
        public String getStartTime() { return startTime; }
        public void setStartTime(String startTime) { this.startTime = startTime; }
        public String getWeight() { return weight; }
        public void setWeight(String weight) { this.weight = weight; }
        public String getInputVideo() { return inputVideo; }
        public void setInputVideo(String inputVideo) { this.inputVideo = inputVideo; }
        public String getConf() { return conf; }
        public void setConf(String conf) { this.conf = conf; }
    }

    @PostMapping("/video")
    public Result<?> videoPredict(@RequestBody VideoRequest request) {
        if (request == null || request.getInputVideo() == null || request.getInputVideo().isEmpty()) {
            return Result.error("-1", "未提供视频链接");
        } else if (request.getWeight() == null || request.getWeight().isEmpty()) {
            return Result.error("-1", "未提供权重");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<VideoRequest> requestEntity = new HttpEntity<>(request, headers);

            String response = restTemplate.postForObject("http://localhost:5000/predictVideoSimple", requestEntity, String.class);
            JSONObject responses = JSONObject.parseObject(response);
            int status = responses.getIntValue("status");
            if(status == 400){
                return Result.error("-1", "Error: " + responses.getString("message"));
            }else {
                return Result.success(response);
            }
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }
}
