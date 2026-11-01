package com.example.Kcsj.controller;

import com.alibaba.fastjson.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.example.Kcsj.common.HazardLevel;
import com.example.Kcsj.common.Result;
import com.example.Kcsj.entity.Message;
import com.example.Kcsj.entity.User;
import com.example.Kcsj.entity.WorkOrder;
import com.example.Kcsj.handler.MessageWebSocketHandler;
import com.example.Kcsj.mapper.MessageMapper;
import com.example.Kcsj.mapper.UserMapper;
import com.example.Kcsj.mapper.WorkOrderMapper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.*;

@RestController
@RequestMapping("/workOrder")
public class WorkOrderController {
    @Resource
    WorkOrderMapper workOrderMapper;
    @Resource
    MessageMapper messageMapper;
    @Resource
    UserMapper userMapper;

    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping
    public Result<?> findPage(
            @RequestParam(name = "pageNum", defaultValue = "1") Integer pageNum,
            @RequestParam(name = "pageSize", defaultValue = "10") Integer pageSize,
            @RequestParam(name = "search1", defaultValue = "") String search1,
            @RequestParam(name = "search2", defaultValue = "") String search2,
            @RequestParam(name = "status", defaultValue = "") String status,
            @RequestParam(name = "level", defaultValue = "") String level) {
        try {
            List<WorkOrder> records = workOrderMapper.selectList(null);
            records.sort((a, b) -> {
                if (a.getCreateTime() == null) return 1;
                if (b.getCreateTime() == null) return -1;
                return b.getCreateTime().compareTo(a.getCreateTime());
            });
            if (!search1.isEmpty()) {
                records = records.stream().filter(r -> contains(r.getOrderNo(), search1)).collect(java.util.stream.Collectors.toList());
            }
            if (!search2.isEmpty()) {
                records = records.stream().filter(r -> contains(r.getHiddenType(), search2)
                        || contains(r.getDescription(), search2)
                        || contains(r.getLocation(), search2)).collect(java.util.stream.Collectors.toList());
            }
            if (!status.isEmpty()) {
                records = records.stream().filter(r -> status.equals(r.getStatus())).collect(java.util.stream.Collectors.toList());
            }
            if (!level.isEmpty()) {
                String normalizedLevel = HazardLevel.normalize(level);
                records = records.stream()
                        .filter(r -> normalizedLevel.equals(HazardLevel.normalize(r.getLevel())))
                        .collect(java.util.stream.Collectors.toList());
            }
            int total = records.size();
            int start = (pageNum - 1) * pageSize;
            int end = Math.min(start + pageSize, total);
            List<WorkOrder> pageRecords = start < total ? records.subList(start, end) : Collections.emptyList();
            return Result.success(new HashMap<String, Object>() {{
                put("list", pageRecords);
                put("total", total);
            }});
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    private static boolean contains(String text, String keyword) {
        return text != null && keyword != null && text.contains(keyword);
    }

    private boolean isTimeoutByDeadline(WorkOrder order) {
        String rectifyDeadline = order.getRectifyDeadline();
        if (rectifyDeadline == null || rectifyDeadline.isEmpty()) {
            return false;
        }
        try {
            Date expected = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").parse(rectifyDeadline);
            return new Date().after(expected);
        } catch (Exception e) {
            System.err.println("整改截止时间解析异常: " + rectifyDeadline);
            return false;
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

    @GetMapping("/{id}")
    public Result<?> findById(@PathVariable Integer id) {
        try {
            WorkOrder order = workOrderMapper.selectById(id);
            return Result.success(order);
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @PostMapping
    public Result<?> create(@RequestBody WorkOrder order) {
        try {
            if (order.getOrderNo() == null || order.getOrderNo().isEmpty()) {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyyMMddHHmmss");
                order.setOrderNo("WO" + sdf.format(new Date()));
            }
            if (order.getStatus() == null || order.getStatus().isEmpty()) {
                order.setStatus("pending");
            }
            String level = HazardLevel.normalize(order.getLevel());
            order.setLevel(level);
            if (order.getDeadline() == null || order.getDeadline().isEmpty()) {
                order.setDeadline(HazardLevel.rectifyTimeout(level));
            }
            String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());
            order.setCreateTime(now);
            order.setUpdateTime(now);
            if (order.getResponseDeadline() == null || order.getResponseDeadline().isEmpty()) {
                order.setResponseDeadline(addMinutes(now, HazardLevel.responseMinutes(level)));
            }
            if (order.getRectifyDeadline() == null || order.getRectifyDeadline().isEmpty()) {
                order.setRectifyDeadline(addMinutes(now, HazardLevel.rectifyMinutes(level)));
            }
            if (order.getRemindCount() == null) {
                order.setRemindCount(0);
            }
            workOrderMapper.insert(order);
            notifyOrder(order, "warning", "新工单待处理",
                    "工单[" + order.getOrderNo() + "]（" + order.getHiddenType() + "）已创建，请及时处理。");
            return Result.success("创建成功");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public Result<?> update(@PathVariable Integer id, @RequestBody WorkOrder order) {
        try {
            WorkOrder existing = workOrderMapper.selectById(id);
            if (existing == null) {
                return Result.error("-1", "工单不存在");
            }
            if (order.getHiddenType() != null) existing.setHiddenType(order.getHiddenType());
            if (order.getLevel() != null) {
                String level = HazardLevel.normalize(order.getLevel());
                existing.setLevel(level);
                if (order.getDeadline() == null) {
                    existing.setDeadline(HazardLevel.rectifyTimeout(level));
                }
                if (order.getResponseDeadline() == null) {
                    String base = existing.getCreateTime() != null ? existing.getCreateTime()
                            : new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());
                    existing.setResponseDeadline(addMinutes(base, HazardLevel.responseMinutes(level)));
                    existing.setRectifyDeadline(addMinutes(base, HazardLevel.rectifyMinutes(level)));
                }
            }
            if (order.getLocation() != null) existing.setLocation(order.getLocation());
            if (order.getDescription() != null) existing.setDescription(order.getDescription());
            if (order.getResponsible() != null) existing.setResponsible(order.getResponsible());
            if (order.getDeadline() != null) existing.setDeadline(order.getDeadline());
            if (order.getResponseDeadline() != null) existing.setResponseDeadline(order.getResponseDeadline());
            if (order.getRectifyDeadline() != null) existing.setRectifyDeadline(order.getRectifyDeadline());
            if (order.getAdjustedLevel() != null) existing.setAdjustedLevel(order.getAdjustedLevel());
            if (order.getAdjustReason() != null) existing.setAdjustReason(order.getAdjustReason());
            if (order.getAdjustUser() != null) existing.setAdjustUser(order.getAdjustUser());
            if (order.getAdjustTime() != null) existing.setAdjustTime(order.getAdjustTime());
            if (order.getStatus() != null) existing.setStatus(order.getStatus());
            if (order.getSuggestion() != null) existing.setSuggestion(order.getSuggestion());
            if (order.getRectifyImg() != null) existing.setRectifyImg(order.getRectifyImg());
            if (order.getRecheckStatus() != null) existing.setRecheckStatus(order.getRecheckStatus());
            if (order.getRecheckResult() != null) existing.setRecheckResult(order.getRecheckResult());
            if (order.getRecheckTime() != null) existing.setRecheckTime(order.getRecheckTime());
            if (order.getAuditOpinion() != null) existing.setAuditOpinion(order.getAuditOpinion());
            if (order.getAuditUser() != null) existing.setAuditUser(order.getAuditUser());
            if (order.getAuditTime() != null) existing.setAuditTime(order.getAuditTime());
            existing.setUpdateTime(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()));
            workOrderMapper.updateById(existing);
            return Result.success("更新成功");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @PutMapping("/{id}/process")
    public Result<?> process(@PathVariable Integer id) {
        try {
            WorkOrder existing = workOrderMapper.selectById(id);
            if (existing == null) {
                return Result.error("-1", "工单不存在");
            }
            existing.setStatus("processing");
            String updateTime = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());
            existing.setUpdateTime(updateTime);
            workOrderMapper.updateById(existing);
            notifyOrder(existing, "info", "工单开始处理",
                    "工单[" + existing.getOrderNo() + "]已开始处理，请跟进整改进度。");
            return Result.success("工单已开始处理");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @PutMapping("/{id}/complete")
    public Result<?> complete(@PathVariable Integer id) {
        try {
            WorkOrder existing = workOrderMapper.selectById(id);
            if (existing == null) {
                return Result.error("-1", "工单不存在");
            }

            String deadline = existing.getDeadline();
            String createTime = existing.getCreateTime();

            boolean isTimeout = isTimeoutByDeadline(existing);
            if ((existing.getRectifyDeadline() == null || existing.getRectifyDeadline().isEmpty())
                    && deadline != null && !deadline.isEmpty() && createTime != null && !createTime.isEmpty()) {
                try {
                    java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("(\\d+)(小时|天|分钟)");
                    java.util.regex.Matcher matcher = pattern.matcher(deadline);
                    if (matcher.find()) {
                        int duration = Integer.parseInt(matcher.group(1));
                        String unit = matcher.group(2);

                        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
                        Date createDate = sdf.parse(createTime);
                        Date expectedDate = new Date(createDate.getTime());

                        if ("小时".equals(unit)) {
                            expectedDate.setTime(createDate.getTime() + duration * 60 * 60 * 1000L);
                        } else if ("天".equals(unit)) {
                            expectedDate.setTime(createDate.getTime() + duration * 24 * 60 * 60 * 1000L);
                        } else if ("分钟".equals(unit)) {
                            expectedDate.setTime(createDate.getTime() + duration * 60 * 1000L);
                        }

                        Date now = new Date();
                        if (now.after(expectedDate)) {
                            isTimeout = true;
                        }
                    }
                } catch (Exception e) {
                    System.err.println("超时判断异常: " + e.getMessage());
                }
            }

            existing.setStatus(isTimeout ? "timeout" : "completed");
            String updateTime = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());
            existing.setUpdateTime(updateTime);
            workOrderMapper.updateById(existing);
            notifyOrder(existing, isTimeout ? "warning" : "success", isTimeout ? "工单超时完成" : "工单已完成",
                    "工单[" + existing.getOrderNo() + "]已" + (isTimeout ? "超时完成" : "完成") + "，请复核。");

            return Result.success(isTimeout ? "工单已超时完成" : "工单已完成");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    @PutMapping("/{id}/close")
    public Result<?> close(@PathVariable Integer id) {
        try {
            WorkOrder existing = workOrderMapper.selectById(id);
            if (existing == null) {
                return Result.error("-1", "工单不存在");
            }
            existing.setStatus("closed");
            existing.setUpdateTime(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()));
            workOrderMapper.updateById(existing);
            notifyOrder(existing, "info", "工单已关闭",
                    "工单[" + existing.getOrderNo() + "]已关闭。");
            return Result.success("工单已关闭");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    private void notifyOrder(WorkOrder order, String type, String title, String content) {
        try {
            String responsible = order.getResponsible() == null ? "" : order.getResponsible()
                    .replace("施工班组", "施工班组长");
            Set<String> roles = new HashSet<>();
            for (String part : responsible.split("[+、,，]")) {
                String role = part.trim();
                if (!role.isEmpty()) roles.add(role);
            }
            List<User> users = userMapper.selectList(null);
            List<String> notified = new ArrayList<>();
            String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());
            for (User user : users) {
                if (notified.size() >= 8) break;
                if (!roles.contains(user.getRole())) continue;
                Message message = new Message();
                message.setUserId(user.getUsername());
                message.setType(type);
                message.setTitle(title);
                message.setContent(content);
                message.setCreateTime(now);
                message.setIsRead(0);
                message.setIsDeleted(0);
                message.setWorkOrderId(order.getId());
                messageMapper.insert(message);
                notified.add(user.getUsername());
            }
            if (notified.isEmpty()) {
                for (User user : users) {
                    if ("管理员".equals(user.getRole())) {
                        Message message = new Message();
                        message.setUserId(user.getUsername());
                        message.setType(type);
                        message.setTitle(title);
                        message.setContent(content);
                        message.setCreateTime(now);
                        message.setIsRead(0);
                        message.setIsDeleted(0);
                        message.setWorkOrderId(order.getId());
                        messageMapper.insert(message);
                        notified.add(user.getUsername());
                        break;
                    }
                }
            }
            if (!notified.isEmpty()) {
                JSONObject push = new JSONObject();
                push.put("type", "new_message");
                push.put("title", title);
                push.put("content", content);
                push.put("hazardLevel", order.getLevel());
                push.put("hiddenType", order.getHiddenType());
                push.put("workOrderId", order.getId());
                push.put("createTime", now);
                MessageWebSocketHandler.sendMessageToMultipleUsers(notified, push.toJSONString());
            }
        } catch (Exception ignored) {
            // 消息通知失败不影响主流程
        }
    }

    @DeleteMapping("/{id}")
    public Result<?> delete(@PathVariable Integer id) {
        try {
            workOrderMapper.deleteById(id);
            return Result.success("删除成功");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    // ==================== Excel台账导出 ====================
    @GetMapping("/export")
    public void exportExcel(
            @RequestParam(name = "search1", defaultValue = "") String search1,
            @RequestParam(name = "search2", defaultValue = "") String search2,
            @RequestParam(name = "status", defaultValue = "") String status,
            @RequestParam(name = "level", defaultValue = "") String level,
            HttpServletResponse response) {
        try {
            // 查询数据（与列表查询逻辑一致）
            List<WorkOrder> records = workOrderMapper.selectList(null);
            records.sort((a, b) -> {
                if (a.getCreateTime() == null) return 1;
                if (b.getCreateTime() == null) return -1;
                return b.getCreateTime().compareTo(a.getCreateTime());
            });
            if (!search1.isEmpty()) {
                records = records.stream().filter(r -> contains(r.getOrderNo(), search1)).collect(java.util.stream.Collectors.toList());
            }
            if (!search2.isEmpty()) {
                records = records.stream().filter(r -> contains(r.getHiddenType(), search2)
                        || contains(r.getDescription(), search2)
                        || contains(r.getLocation(), search2)).collect(java.util.stream.Collectors.toList());
            }
            if (!status.isEmpty()) {
                records = records.stream().filter(r -> status.equals(r.getStatus())).collect(java.util.stream.Collectors.toList());
            }
            if (!level.isEmpty()) {
                String normalizedLevel = HazardLevel.normalize(level);
                records = records.stream()
                        .filter(r -> normalizedLevel.equals(HazardLevel.normalize(r.getLevel())))
                        .collect(java.util.stream.Collectors.toList());
            }

            // 生成Excel
            Workbook workbook = new XSSFWorkbook();
            Sheet sheet = workbook.createSheet("安全台账");

            // 标题行样式
            CellStyle headerStyle = workbook.createCellStyle();
            Font headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 12);
            headerStyle.setFont(headerFont);
            headerStyle.setAlignment(HorizontalAlignment.CENTER);
            headerStyle.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            // 数据行样式
            CellStyle dataStyle = workbook.createCellStyle();
            dataStyle.setBorderBottom(BorderStyle.THIN);
            dataStyle.setBorderTop(BorderStyle.THIN);
            dataStyle.setBorderLeft(BorderStyle.THIN);
            dataStyle.setBorderRight(BorderStyle.THIN);
            dataStyle.setAlignment(HorizontalAlignment.CENTER);
            dataStyle.setVerticalAlignment(VerticalAlignment.CENTER);

            // 表头
            String[] headers = {"序号", "工单编号", "隐患类型", "隐患等级", "隐患位置", "隐患描述",
                    "责任人", "整改时限", "当前状态", "整改建议", "审核意见", "AI复核结果",
                    "创建时间", "更新时间"};
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // 状态映射
            Map<String, String> statusMap = new HashMap<>();
            statusMap.put("pending", "待处理");
            statusMap.put("processing", "处理中");
            statusMap.put("completed", "已完成");
            statusMap.put("timeout", "超时完成");
            statusMap.put("closed", "已关闭");

            // 复核状态映射
            Map<String, String> recheckMap = new HashMap<>();
            recheckMap.put("pending", "待复核");
            recheckMap.put("passed", "复核通过");
            recheckMap.put("failed", "复核不通过");

            // 数据行
            for (int i = 0; i < records.size(); i++) {
                WorkOrder order = records.get(i);
                Row row = sheet.createRow(i + 1);
                String[] values = {
                        String.valueOf(i + 1),
                        order.getOrderNo() != null ? order.getOrderNo() : "",
                        order.getHiddenType() != null ? order.getHiddenType() : "",
                        order.getLevel() != null ? order.getLevel() : "",
                        order.getLocation() != null ? order.getLocation() : "",
                        order.getDescription() != null ? order.getDescription() : "",
                        order.getResponsible() != null ? order.getResponsible() : "",
                        order.getDeadline() != null ? order.getDeadline() : "",
                        statusMap.getOrDefault(order.getStatus(), order.getStatus() != null ? order.getStatus() : ""),
                        order.getSuggestion() != null ? order.getSuggestion() : "",
                        order.getAuditOpinion() != null ? order.getAuditOpinion() : "未审核",
                        order.getRecheckStatus() != null ? recheckMap.getOrDefault(order.getRecheckStatus(), order.getRecheckStatus()) : "未复核",
                        order.getCreateTime() != null ? order.getCreateTime() : "",
                        order.getUpdateTime() != null ? order.getUpdateTime() : ""
                };
                for (int j = 0; j < values.length; j++) {
                    Cell cell = row.createCell(j);
                    cell.setCellValue(values[j]);
                    cell.setCellStyle(dataStyle);
                }
            }

            // 自动列宽
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                // 设置最小列宽
                int width = sheet.getColumnWidth(i);
                sheet.setColumnWidth(i, Math.max(width, 2500));
            }

            // 输出到响应
            String fileName = URLEncoder.encode("安全台账_" + new SimpleDateFormat("yyyyMMddHHmmss").format(new Date()) + ".xlsx", "UTF-8");
            response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            response.setHeader("Content-Disposition", "attachment; filename=" + fileName);
            response.setCharacterEncoding("UTF-8");

            OutputStream outputStream = response.getOutputStream();
            workbook.write(outputStream);
            outputStream.flush();
            workbook.close();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // ==================== 工单审核意见 ====================
    @PutMapping("/{id}/audit")
    public Result<?> audit(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        try {
            WorkOrder existing = workOrderMapper.selectById(id);
            if (existing == null) {
                return Result.error("-1", "工单不存在");
            }
            String auditOpinion = body.get("auditOpinion");
            String auditUser = body.get("auditUser");
            if (auditOpinion == null || auditOpinion.isEmpty()) {
                return Result.error("-1", "审核意见不能为空");
            }
            existing.setAuditOpinion(auditOpinion);
            existing.setAuditUser(auditUser != null ? auditUser : "");
            existing.setAuditTime(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()));
            existing.setUpdateTime(existing.getAuditTime());
            workOrderMapper.updateById(existing);
            return Result.success("审核意见已提交");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    // ==================== 工单督办提醒 ====================
    @PutMapping("/{id}/remind")
    public Result<?> remind(@PathVariable Integer id, @RequestBody Map<String, String> body) {
        try {
            WorkOrder existing = workOrderMapper.selectById(id);
            if (existing == null) {
                return Result.error("-1", "工单不存在");
            }
            String remindUser = body.get("remindUser");
            String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());

            // 更新督办次数和时间
            int count = existing.getRemindCount() != null ? existing.getRemindCount() : 0;
            existing.setRemindCount(count + 1);
            existing.setLastRemindTime(now);
            existing.setUpdateTime(now);
            workOrderMapper.updateById(existing);

            // 向责任人发送督办消息 - 根据responsible字段解析角色，查找对应用户
            String responsible = existing.getResponsible();
            // 角色名称映射：保留“现场施工人员”，不合并成班组长
            if (responsible != null) {
                responsible = responsible.replace("施工班组", "施工班组长");
            }
            List<User> users = new ArrayList<>();

            if (responsible != null && !responsible.isEmpty()) {
                // 解析responsible字段，可能包含多个角色用+或、分隔
                List<String> rolesToNotify = new ArrayList<>();
                String[] parts = responsible.split("[+、,，]");
                for (String part : parts) {
                    String trimmed = part.trim();
                    if (!trimmed.isEmpty()) {
                        rolesToNotify.add(trimmed);
                    }
                }

                // 先尝试按角色查找用户
                if (!rolesToNotify.isEmpty()) {
                    LambdaQueryWrapper<User> roleWrapper = Wrappers.<User>lambdaQuery();
                    roleWrapper.in(User::getRole, rolesToNotify);
                    users = userMapper.selectList(roleWrapper);
                }

                // 如果按角色没找到，尝试按用户名精确匹配
                if (users.isEmpty()) {
                    LambdaQueryWrapper<User> usernameWrapper = Wrappers.<User>lambdaQuery();
                    usernameWrapper.eq(User::getUsername, responsible);
                    users = userMapper.selectList(usernameWrapper);
                }
            }

            // 如果还没找到用户，按隐患等级推送对应角色
            if (users.isEmpty()) {
                List<String> defaultRoles = HazardLevel.pushRoles(existing.getLevel());
                LambdaQueryWrapper<User> defaultWrapper = Wrappers.<User>lambdaQuery();
                defaultWrapper.in(User::getRole, defaultRoles);
                users = userMapper.selectList(defaultWrapper);
            }

            List<String> userIds = new ArrayList<>();
            for (User user : users) {
                userIds.add(user.getUsername());
                Message message = new Message();
                message.setUserId(user.getUsername());
                message.setType("warning");
                message.setTitle("工单督办提醒");
                message.setContent("工单[" + existing.getOrderNo() + "]已督办" + (count + 1) + "次，请尽快处理！" +
                        "隐患类型：" + existing.getHiddenType() + "，请及时整改。");
                message.setCreateTime(now);
                message.setIsRead(0);
                message.setIsDeleted(0);
                message.setWorkOrderId(existing.getId());
                messageMapper.insert(message);
            }

            // WebSocket实时推送
            if (!userIds.isEmpty()) {
                JSONObject pushMessage = new JSONObject();
                pushMessage.put("type", "new_message");
                pushMessage.put("title", "工单督办提醒");
                pushMessage.put("content", "工单[" + existing.getOrderNo() + "]请尽快处理！");
                pushMessage.put("hazardLevel", existing.getLevel());
                pushMessage.put("hiddenType", existing.getHiddenType());
                pushMessage.put("workOrderId", existing.getId());
                pushMessage.put("createTime", now);
                MessageWebSocketHandler.sendMessageToMultipleUsers(userIds, pushMessage.toJSONString());
            }

            return Result.success("督办提醒已发送（第" + (count + 1) + "次）");
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }

    // ==================== AI二次复核 ====================
    @PostMapping("/{id}/recheck")
    public Result<?> recheck(@PathVariable Integer id, @RequestParam(value = "rectifyImgFile", required = false) MultipartFile file,
                             @RequestParam(value = "rectifyImg", required = false) String rectifyImgUrl,
                             HttpServletRequest request) {
        try {
            WorkOrder existing = workOrderMapper.selectById(id);
            if (existing == null) {
                return Result.error("-1", "工单不存在");
            }
            String rectifyImg = rectifyImgUrl;

            // 如果上传了文件，保存文件并生成URL
            if (file != null && !file.isEmpty()) {
                String originalFilename = file.getOriginalFilename();
                String suffix = originalFilename.substring(originalFilename.lastIndexOf("."));
                String fileName = "recheck_" + System.currentTimeMillis() + suffix;
                String uploadDir = System.getProperty("user.dir") + "\\files\\recheck\\";
                java.io.File dir = new java.io.File(uploadDir);
                if (!dir.exists()) dir.mkdirs();
                java.io.File destFile = new java.io.File(uploadDir + fileName);
                file.transferTo(destFile);
                // 构造访问URL
                String scheme = request.getScheme();
                String serverName = request.getServerName();
                int port = request.getServerPort();
                rectifyImg = scheme + "://" + serverName + ":" + port + "/files/recheck/" + fileName;
            }

            if (rectifyImg == null || rectifyImg.isEmpty()) {
                return Result.error("-1", "请提供整改图片");
            }

            // 保存整改图片路径
            existing.setRectifyImg(rectifyImg);
            existing.setRecheckStatus("pending");
            String now = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());
            existing.setUpdateTime(now);
            workOrderMapper.updateById(existing);

            // 调用Flask服务进行AI检测
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);

                Map<String, Object> requestBody = new HashMap<>();
                requestBody.put("inputImg", rectifyImg);
                requestBody.put("weight", "construction_safety.pt");
                requestBody.put("conf", "0.6");

                HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);
                String response = restTemplate.postForObject("http://localhost:5000/predictImg", requestEntity, String.class);
                JSONObject result = JSONObject.parseObject(response);

                // 判断复核结果
                if (result != null && "200".equals(String.valueOf(result.get("status")))) {
                    com.alibaba.fastjson.JSONArray labels = result.getJSONArray("label");
                    
                    // 检查是否真的有隐患（排除"未检测到安全隐患"的情况）
                    boolean hasHazard = false;
                    if (labels != null && !labels.isEmpty()) {
                        for (int i = 0; i < labels.size(); i++) {
                            String label = labels.getString(i);
                            if (label != null && !label.contains("未检测到")) {
                                hasHazard = true;
                                break;
                            }
                        }
                    }
                    
                    if (!hasHazard) {
                        // 未检测到隐患 → AI复核通过
                        existing.setRecheckStatus("passed");
                        existing.setRecheckResult("AI复核通过：未检测到安全隐患，隐患已消除。");
                    } else {
                        // 仍检测到隐患 → 复核不通过
                        StringBuilder detectedHazards = new StringBuilder();
                        for (int i = 0; i < labels.size(); i++) {
                            String label = labels.getString(i);
                            if (label != null && !label.contains("未检测到")) {
                                if (detectedHazards.length() > 0) detectedHazards.append("、");
                                detectedHazards.append(label);
                            }
                        }
                        existing.setRecheckStatus("failed");
                        existing.setRecheckResult("AI复核不通过：仍检测到隐患[" + detectedHazards.toString() + "]，请继续整改。");
                    }
                } else {
                    // Flask返回错误
                    existing.setRecheckStatus("failed");
                    existing.setRecheckResult("AI复核异常：检测服务返回错误，请稍后重试。");
                }
            } catch (Exception e) {
                // Flask服务不可用
                existing.setRecheckStatus("failed");
                existing.setRecheckResult("AI复核异常：无法连接检测服务(" + e.getMessage() + ")，请确认检测服务已启动。");
            }

            existing.setRecheckTime(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date()));
            existing.setUpdateTime(existing.getRecheckTime());
            workOrderMapper.updateById(existing);

            // 返回复核结果
            Map<String, Object> data = new HashMap<>();
            data.put("recheckStatus", existing.getRecheckStatus());
            data.put("recheckResult", existing.getRecheckResult());
            data.put("recheckTime", existing.getRecheckTime());
            return Result.success(data);
        } catch (Exception e) {
            return Result.error("-1", "Error: " + e.getMessage());
        }
    }
}
