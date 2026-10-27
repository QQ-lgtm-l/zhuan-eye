package com.example.Kcsj.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@TableName("work_order")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class WorkOrder {
    @TableId(type = IdType.AUTO)
    private Integer id;
    private String orderNo;
    private String hiddenType;
    private String level;
    private String location;
    private String description;
    private String responsible;
    private String deadline;
    private String status;
    private String suggestion;
    private String createTime;
    private String updateTime;
    private Integer recordId;

    // AI二次复核相关字段
    private String rectifyImg;       // 整改图片路径
    private String recheckStatus;    // 复核状态: pending/passed/failed
    private String recheckResult;    // 复核结果描述
    private String recheckTime;      // 复核时间

    // 工单审核相关字段
    private String auditOpinion;     // 审核意见
    private String auditUser;        // 审核人
    private String auditTime;        // 审核时间

    // 督办提醒相关字段
    private Integer remindCount;     // 督办次数
    private String lastRemindTime;   // 最后督办时间

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getOrderNo() {
        return orderNo;
    }

    public void setOrderNo(String orderNo) {
        this.orderNo = orderNo;
    }

    public String getHiddenType() {
        return hiddenType;
    }

    public void setHiddenType(String hiddenType) {
        this.hiddenType = hiddenType;
    }

    public String getLevel() {
        return level;
    }

    public void setLevel(String level) {
        this.level = level;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getResponsible() {
        return responsible;
    }

    public void setResponsible(String responsible) {
        this.responsible = responsible;
    }

    public String getDeadline() {
        return deadline;
    }

    public void setDeadline(String deadline) {
        this.deadline = deadline;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getSuggestion() {
        return suggestion;
    }

    public void setSuggestion(String suggestion) {
        this.suggestion = suggestion;
    }

    public String getCreateTime() {
        return createTime;
    }

    public void setCreateTime(String createTime) {
        this.createTime = createTime;
    }

    public String getUpdateTime() {
        return updateTime;
    }

    public void setUpdateTime(String updateTime) {
        this.updateTime = updateTime;
    }

    public Integer getRecordId() {
        return recordId;
    }

    public void setRecordId(Integer recordId) {
        this.recordId = recordId;
    }

    public String getRectifyImg() {
        return rectifyImg;
    }

    public void setRectifyImg(String rectifyImg) {
        this.rectifyImg = rectifyImg;
    }

    public String getRecheckStatus() {
        return recheckStatus;
    }

    public void setRecheckStatus(String recheckStatus) {
        this.recheckStatus = recheckStatus;
    }

    public String getRecheckResult() {
        return recheckResult;
    }

    public void setRecheckResult(String recheckResult) {
        this.recheckResult = recheckResult;
    }

    public String getRecheckTime() {
        return recheckTime;
    }

    public void setRecheckTime(String recheckTime) {
        this.recheckTime = recheckTime;
    }

    public String getAuditOpinion() {
        return auditOpinion;
    }

    public void setAuditOpinion(String auditOpinion) {
        this.auditOpinion = auditOpinion;
    }

    public String getAuditUser() {
        return auditUser;
    }

    public void setAuditUser(String auditUser) {
        this.auditUser = auditUser;
    }

    public String getAuditTime() {
        return auditTime;
    }

    public void setAuditTime(String auditTime) {
        this.auditTime = auditTime;
    }

    public Integer getRemindCount() {
        return remindCount;
    }

    public void setRemindCount(Integer remindCount) {
        this.remindCount = remindCount;
    }

    public String getLastRemindTime() {
        return lastRemindTime;
    }

    public void setLastRemindTime(String lastRemindTime) {
        this.lastRemindTime = lastRemindTime;
    }
}
